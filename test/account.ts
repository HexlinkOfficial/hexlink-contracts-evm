import { expect } from "chai";
import { ethers, deployments, getNamedAccounts, artifacts, run } from "hardhat";
import { Contract } from "ethers";
import { hash } from "../tasks/utils";

const senderName = "mailto:sender@gmail.com";
const sender = hash(senderName);
const receiverName = "mailto:receiver@gmail.com";
const receiver = hash(receiverName);

const genERC20TransferTxData = async function (
  receiver: string,
  amount: Number
): Promise<string> {
  const artifact = await artifacts.readArtifact("ERC20");
  const iface = new ethers.utils.Interface(artifact.abi);
  return iface.encodeFunctionData(
    "transfer",
    [receiver, amount]
  );
}

const deployAccount = async (hexlink: Contract, nameHash: string, owner: string) => {
  const name = {
    schema: hash("mailto"),
    domain: hash("gmail.com"),
    name: nameHash
  };
  const proof = await run("build_deploy_auth_proof", {
    name: nameHash,
    owner,
    validator: "validator",
    hexlink: hexlink.address,
  });
  const accountAddr = await hexlink.ownedAccount(nameHash);
  await expect(
    hexlink.deploy(name, owner, proof)
  ).to.emit(hexlink, "Deployed").withArgs(
    nameHash, accountAddr
  );
}

describe("Hexlink Account", function () {
  let hexlink: Contract;
  let account: Contract;
  let proxy: Contract;
  let beacon: Contract;
  let impl: string;
  let admin: string;

  beforeEach(async function () {
    await deployments.fixture(["TEST"]);
    const result = await run("deployAll", {});
    hexlink = await ethers.getContractAt("Hexlink", result.hexlinkProxy);
    account = await ethers.getContractAt("Account", result.accountProxy);
    proxy = await ethers.getContractAt("AccountProxy", result.accountProxy);
    beacon = await ethers.getContractAt("AccountBeacon", result.accountBeacon);
    impl = result.accountImpl;
    admin = result.admin;
  });

  it("Should with correct beacon and implementation", async function () {
    expect(await beacon.implementation()).to.eq(impl);
    expect(await proxy.beacon()).to.eq(beacon.address);

    const { deployer } = await getNamedAccounts();

    const impl2 = await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer,
        args: [await account.entryPoint()]
      }
    );
    const data = beacon.interface.encodeFunctionData(
      "upgradeTo", [impl2.address]
    );
    await expect(beacon.upgradeTo(impl2.address)).to.be.reverted;
    await run("admin_schedule_and_exec", {
      target: beacon.address,
      data,
      admin
    })
    expect(await beacon.implementation()).to.eq(impl2.address);
    expect(await proxy.beacon()).to.eq(beacon.address);
  });

  it("Should transfer erc20 successfully", async function () {
    const senderAddr = await hexlink.ownedAccount(sender);
    const { deployer } = await ethers.getNamedSigners();

    // receive tokens before account created
    const token = await ethers.getContractAt(
      "HexlinkToken",
      (await deployments.get("HexlinkToken")).address
    );
    await expect(
      token.connect(deployer).transfer(senderAddr, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, senderAddr, 5000);
    expect(await token.balanceOf(senderAddr)).to.eq(5000);

    // deploy account contract
    await deployAccount(hexlink, sender, deployer.address);

    // receive tokens after account created
    await expect(
      token.connect(deployer).transfer(senderAddr, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, senderAddr, 5000);
    expect(await token.balanceOf(senderAddr)).to.eq(10000);

    // send tokens
    expect(await token.balanceOf(senderAddr)).to.eq(10000);
    const receiverAddr = await hexlink.ownedAccount(receiver);
    const senderAcc = await ethers.getContractAt("Account", senderAddr);
    await senderAcc.connect(deployer).exec(
      token.address,
      0,
      token.interface.encodeFunctionData(
        "transfer",
        [receiverAddr, 5000]
      )
    );
    expect(await token.balanceOf(senderAddr)).to.eq(5000);
    expect(await token.balanceOf(receiverAddr)).to.eq(5000);
  });

  it("Should transfer eth successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();
    const senderAddr = await hexlink.ownedAccount(sender);

    // receive eth before account created
    const tx1 = await deployer.sendTransaction({
      to: senderAddr,
      value: ethers.utils.parseEther("1.0")
    });
    await tx1.wait();
    expect(
      await ethers.provider.getBalance(senderAddr)
    ).to.eq(ethers.utils.parseEther("1.0"));

    // create new account contract
    await deployAccount(hexlink, sender, deployer.address);

    // receive eth after account created
    const tx2 = await deployer.sendTransaction({
      to: senderAddr,
      value: ethers.utils.parseEther("1.0")
    });
    await tx2.wait();
    expect(
      await ethers.provider.getBalance(senderAddr)
    ).to.eq(ethers.utils.parseEther("2.0"));

    // send ETH
    const receiverAddr = await hexlink.ownedAccount(receiver);
    const senderAcc = await ethers.getContractAt("Account", senderAddr);
    await senderAcc.connect(deployer).exec(
      receiverAddr,
      ethers.utils.parseEther("0.5"),
      []
    );
    expect(
      await ethers.provider.getBalance(receiverAddr)
    ).to.eq(ethers.utils.parseEther("0.5").toHexString());
  });

  it("Should hold and transfer ERC1155 successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();
    const senderAddr = await hexlink.ownedAccount(sender);

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
        deployer.address, senderAddr, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, senderAddr, 1, 10);
    expect(await erc1155.balanceOf(senderAddr, 1)).to.eq(10);

    // create new account contract
    await deployAccount(hexlink, sender, deployer.address);

    // receive erc1155 after account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, senderAddr, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, senderAddr, 1, 10);
    expect(await erc1155.balanceOf(senderAddr, 1)).to.eq(20);

    // send erc1155
    const receiverAddr = await hexlink.ownedAccount(receiver);
    const senderAcc = await ethers.getContractAt("Account", senderAddr);
    await senderAcc.connect(deployer).exec(
      erc1155.address,
      0,
      erc1155.interface.encodeFunctionData(
        "safeTransferFrom",
        [senderAddr, receiverAddr, 1, 10, []]
      )
    );
    expect(await erc1155.balanceOf(senderAddr, 1)).to.eq(10);
    expect(await erc1155.balanceOf(receiverAddr, 1)).to.eq(10);
  });
});
