import { expect } from "chai";
import * as hre from "hardhat";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import {
  EMAIL_NAME_TYPE,
  SENDER_NAME_HASH,
  RECEIVER_NAME_HASH,
  callWithEntryPoint,
  callEntryPointWithTester,
  buildAccountExecData,
  genInitCode
} from "./testers";
import { getHexlink } from "../tasks/utils";

export const deploySender = async (hexlink: Contract) : Promise<Contract> => {
  const accountAddr = await hexlink.getOwnedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
  await expect(
    hexlink.deploy(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
  ).to.emit(hexlink, "AccountDeployed").withArgs(
    EMAIL_NAME_TYPE, SENDER_NAME_HASH, accountAddr
  );
  return await ethers.getContractAt("Account", accountAddr);
}

describe("Hexlink Account", function () {
  let hexlink: Contract;
  let entrypoint: Contract;
  let sender: string;
  let receiver: string;

  beforeEach(async function () {
    await deployments.fixture(["TEST"]);
    hexlink = await getHexlink(hre);
    await hre.run("set_auth_providers", []);
    await hre.run("upgrade_account", []);

    sender = await hexlink.getOwnedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
    receiver = await hexlink.getOwnedAccount(EMAIL_NAME_TYPE, RECEIVER_NAME_HASH);
    entrypoint = await ethers.getContractAt(
      "EntryPoint",
      (await deployments.get("EntryPoint")).address
    );
    // deposit eth before account created
    const { deployer } = await hre.ethers.getNamedSigners();
    await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
  });

  it("Should upgrade successfully", async function () {
    const { deployer } = await getNamedAccounts();
    let account = await deploySender(hexlink);
    const impl2 = await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer,
        args: [await account.entryPoint(), await account.hexlink()]
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

    await expect(
      account.upgradeTo(impl2.address)
    ).to.be.reverted;

    const callData = await buildAccountExecData(
      sender,
      0,
      account.interface.encodeFunctionData(
        "upgradeTo",
        [impl2.address]
      )
    );
    // cannot upgrade to impl2 since impl2 is not set at hexlink
    // this will not revert because handleOps will catch the exception
    await callWithEntryPoint(sender, [], callData, entrypoint)
    expect(await account.implementation()).to.not.eq(impl2.address);

    // update account implementation and upgrade
    await hre.run("upgrade_account", {account: impl2.address});
    await callWithEntryPoint(sender, [], callData, entrypoint)
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

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint);

    // receive tokens after account created
    await expect(
      token.connect(deployer).transfer(sender, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await token.balanceOf(sender)).to.eq(10000);

    const erc20Data = token.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(token.address, 0, erc20Data);
    await callWithEntryPoint(sender, [], callData, entrypoint);
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
    ).to.eq(ethers.utils.parseEther("2.0"));

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint);

    // receive eth after account created
    const tx2 = await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
    await tx2.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.gt(ethers.utils.parseEther("2.5"));

    // send ETH
    const callData = await buildAccountExecData(
      receiver, ethers.utils.parseEther("0.5")
    );
    await callWithEntryPoint(sender, [], callData, entrypoint);
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

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint);

    // receive erc1155 after account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(20);

    // send erc1155
    const erc1155Data = erc1155.interface.encodeFunctionData(
      "safeTransferFrom",
      [sender, receiver, 1, 10, []]
    );
    const callData = await buildAccountExecData(erc1155.address, 0, erc1155Data);
    await callWithEntryPoint(sender, [], callData, entrypoint);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);
    expect(await erc1155.balanceOf(receiver, 1)).to.eq(10);
  });

  it("Should not execute if the auth provider is dAuth and validator doesn't match the signer", async function() {
    const { deployer } = await ethers.getNamedSigners();

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callEntryPointWithTester(sender, initCode, [], entrypoint);

    // get first factor and check
    const account = await ethers.getContractAt("Account", sender);
    const factors = await account.getAuthFactors();
    const authProvider = await deployments.get("SimpleAuthProvider");
    expect(factors[0].provider).to.eq(authProvider.address);

    // receive tokens after account created
    const token = await ethers.getContractAt(
      "HexlinkToken",
      (await deployments.get("HexlinkToken")).address
    );
    await expect(
      token.connect(deployer).transfer(sender, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await token.balanceOf(sender)).to.eq(5000);

    // should not execute
    const erc20Data = token.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(token.address, 0, erc20Data);
    await callEntryPointWithTester(sender, [], callData, entrypoint);
    expect(await token.balanceOf(sender)).to.eq(5000);
    expect(await token.balanceOf(receiver)).to.eq(0);
  });
});
