import { expect } from "chai";
import * as hre from "hardhat";
import { ethers, deployments, getNamedAccounts, run, artifacts } from "hardhat";
import { Contract } from "ethers";
import { buildAuthProof } from "../tasks/utils";
import { senderName, senderNameHash, receiverNameHash} from "./testers";

export const buildAccountInitData = async (owner: string) => {
  const artifact = await artifacts.readArtifact("Account");
  const iface = new ethers.utils.Interface(artifact.abi);
  return iface.encodeFunctionData("init", [owner]);
}

const deploySender = async (
  hexlink: Contract,
  owner: string
) : Promise<Contract> => {

  const accountAddr = await hexlink.ownedAccount(senderNameHash);
  const data = await buildAccountInitData(owner);
  const proof = await buildAuthProof(
    hre,
    senderNameHash,
    data,
    "validator",
    hexlink.address
  );
  await expect(
    hexlink.deploy(senderName, data, proof)
  ).to.emit(hexlink, "Deployed").withArgs(
    senderNameHash, accountAddr
  );
  return await ethers.getContractAt("Account", accountAddr);
}

describe("Hexlink Account", function () {
  let hexlink: Contract;
  let admin: string;
  let sender: string;
  let receiver: string;

  beforeEach(async function () {
    await deployments.fixture(["TEST"]);
    const hexlinkProxy = await run("deployHexlinkProxy", {});
    hexlink = await ethers.getContractAt("Hexlink", hexlinkProxy);
    admin = (await deployments.get("HexlinkAdmin")).address
    sender = await hexlink.ownedAccount(senderNameHash);
    receiver = await hexlink.ownedAccount(receiverNameHash);
  });

  it("Should upgrade successfully", async function () {
    const { deployer } = await getNamedAccounts();
    let account = await deploySender(hexlink, deployer);
    const impl2 = await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer,
        args: [await account.entryPoint()]
      }
    );

    const accountProxy = await ethers.getContractAt(
      "HexlinkERC1967Proxy",
      account.address
    );
    await expect(
      accountProxy.initProxy(impl2.address, [])
    ).to.be.reverted;

    await expect(
      account.upgradeTo(ethers.constants.AddressZero)
    ).to.be.reverted;

    const tx = await account.upgradeTo(impl2.address);
    await tx.wait();
    expect(await account.implementation()).to.eq(impl2.address);
  });

  it("Should transfer erc20 successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();

    // receive tokens before account created
    const token = await ethers.getContractAt(
      "HexlinkToken",
      (await deployments.get("HexlinkToken")).address
    );
    await expect(
      token.connect(deployer).transfer(sender, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await token.balanceOf(sender)).to.eq(5000);

    // deploy account contract
    await deploySender(hexlink, deployer.address);

    // receive tokens after account created
    await expect(
      token.connect(deployer).transfer(sender, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await token.balanceOf(sender)).to.eq(10000);

    const senderAcc = await ethers.getContractAt("Account", sender);
    // send tokens with owner
    expect(await token.balanceOf(sender)).to.eq(10000);
    await senderAcc.connect(deployer).exec(
      token.address,
      0,
      token.interface.encodeFunctionData(
        "transfer",
        [receiver, 5000]
      )
    );
    expect(await token.balanceOf(sender)).to.eq(5000);
    expect(await token.balanceOf(receiver)).to.eq(5000);
  });

  it("Should transfer eth successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();

    // receive eth before account created
    const tx1 = await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
    await tx1.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.eq(ethers.utils.parseEther("1.0"));

    // create new account contract
    await deploySender(hexlink, deployer.address);

    // receive eth after account created
    const tx2 = await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
    await tx2.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.eq(ethers.utils.parseEther("2.0"));

    // send ETH
    const senderAcc = await ethers.getContractAt("Account", sender);
    await senderAcc.connect(deployer).exec(
      receiver,
      ethers.utils.parseEther("0.5"),
      []
    );
    expect(
      await ethers.provider.getBalance(receiver)
    ).to.eq(ethers.utils.parseEther("0.5").toHexString());
  });

  it("Should hold and transfer ERC1155 successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();
    const deployed = await deployments.deploy("TestHexlinkERC1155", {
      from: deployer.address,
      log: true,
      autoMine: true,
    });
    const erc1155 = await ethers.getContractAt(
      "TestHexlinkERC1155",
      deployed.address
    );

    // receive erc1155 before account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);

    // create new account contract
    await deploySender(hexlink, deployer.address);

    // receive erc1155 after account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(20);

    // send erc1155
    const senderAcc = await ethers.getContractAt("Account", sender);
    await senderAcc.connect(deployer).exec(
      erc1155.address,
      0,
      erc1155.interface.encodeFunctionData(
        "safeTransferFrom",
        [sender, receiver, 1, 10, []]
      )
    );
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);
    expect(await erc1155.balanceOf(receiver, 1)).to.eq(10);
  });
});
