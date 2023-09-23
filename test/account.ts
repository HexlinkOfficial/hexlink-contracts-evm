import { expect } from "chai";
import * as hre from "hardhat";
import { ethers, deployments } from "hardhat";
import {
  SENDER_NAME_HASH,
  RECEIVER_NAME_HASH,
  callWithEntryPoint,
  call2faWithEntryPoint,
  buildAccountExecData,
  genInitCode
} from "./testers";
import { getHexlink } from "../tasks/utils";
import {
  EntryPoint__factory,
  Account__factory,
  TestHexlinkERC20__factory,
  TestHexlinkERC1155__factory,
  Hexlink,
  Account,
  EntryPoint
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export const deploySender = async (hexlink: Hexlink) : Promise<Account> => {
  const {deployer} = await ethers.getNamedSigners();
  const accountAddr = await hexlink.getOwnedAccount(SENDER_NAME_HASH);
  await expect(
    hexlink.deploy(SENDER_NAME_HASH)
  ).to.emit(hexlink, "AccountDeployed").withArgs(
    SENDER_NAME_HASH, accountAddr
  );
  return Account__factory.connect(
    accountAddr, hre.ethers.provider
  ).connect(deployer);
}

async function deployErc20() {
  const {deployer} = await ethers.getNamedSigners();
  const deployed = await deployments.deploy("TestHexlinkERC20", {
    from: deployer.address,
    log: true,
    autoMine: true,
  });
  return TestHexlinkERC20__factory.connect(
    deployed.address, hre.ethers.provider
  ).connect(deployer);
}

describe("Hexlink Account", function () {
  let hexlink: Hexlink;
  let entrypoint: EntryPoint;
  let sender: string;
  let receiver: string;
  let admin: string;
  let deployer: HardhatEthersSigner;

  beforeEach(async function () {
    const signers = await ethers.getNamedSigners();
    deployer = signers.deployer;
    await deployments.fixture(["TEST"]);
    hexlink = (await getHexlink(hre)).connect(deployer);

    admin = (await deployments.get("HexlinkAdmin")).address;
    sender = await hexlink.getOwnedAccount(SENDER_NAME_HASH);
    receiver = await hexlink.getOwnedAccount(RECEIVER_NAME_HASH);
    entrypoint = EntryPoint__factory.connect(
      (await deployments.get("EntryPoint")).address,
      hre.ethers.provider
    ).connect(deployer);
    // deposit eth before account created
    await deployer.sendTransaction({
      to: sender,
      value: ethers.parseEther("1.0")
    });
  });

  it("Should upgrade successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();
    let account = await deploySender(hexlink);
    const version = await account.version();
    expect(await hexlink.getLatestVersion()).to.eq(version);
    const impl2 = (await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer.address,
        args: [await account.entryPoint(), await account.getERC4972Registry()]
      }
    )).address;

    const accountProxy = await ethers.getContractAt(
      "HexlinkERC1967Proxy",
      await account.getAddress(),
    );
    await expect(
      accountProxy.initProxy(impl2, '0x')
    ).to.be.reverted;

    await expect(
      account.upgradeTo(ethers.ZeroAddress)
    ).to.be.reverted;

    await expect(
      account.upgradeTo(impl2)
    ).to.be.reverted;

    // invalid impl
    const invalidCallData = await buildAccountExecData(
      sender,
      0,
      account.interface.encodeFunctionData(
        "upgradeTo",
        [ethers.ZeroAddress]
      )
    );
    expect(
      await callWithEntryPoint(sender, '0x', invalidCallData, entrypoint, validator)
    ).to.throw;

    const callData = await buildAccountExecData(
      sender,
      0,
      account.interface.encodeFunctionData(
        "upgradeTo",
        [impl2]
      )
    );
    // account2 is not registered in hexlink yet so will revert
    expect(
      await callWithEntryPoint(sender, '0x', callData, entrypoint, validator)
    ).to.throw;

    // register implementation at hexlink
    const data = hexlink.interface.encodeFunctionData(
      "upgradeImplementation",
      [impl2]
    );
    await hre.run(
      "admin_schedule_and_exec",
      {target: await hexlink.getAddress(), data, admin}
    );
    expect(await hexlink.getLatestVersion()).to.eq(version + BigInt(1));

    // account2 is registered in hexlink so will upgrade
    await callWithEntryPoint(sender, '0x', callData, entrypoint, validator)
    expect(await account.implementation()).to.eq(impl2);
    expect(await account.version()).to.eq(version + BigInt(1));
  });

  it("Should transfer erc20 successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();
    const erc20 = await deployErc20();
    // receive tokens before account created
    await expect(
      erc20.connect(deployer).transfer(sender, 5000)
    ).to.emit(erc20, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await erc20.balanceOf(sender)).to.eq(5000);

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, '0x', entrypoint, validator);

    // receive tokens after account created
    await expect(
      erc20.connect(deployer).transfer(sender, 5000)
    ).to.emit(erc20, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await erc20.balanceOf(sender)).to.eq(10000);

    const erc20Data = erc20.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(
      await erc20.getAddress(), 0, erc20Data);
    await callWithEntryPoint(sender, '0x', callData, entrypoint, validator);
    expect(await erc20.balanceOf(sender)).to.eq(5000);
    expect(await erc20.balanceOf(receiver)).to.eq(5000);
  });

  it("Should transfer eth successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();

    // receive eth before account created
    const tx1 = await deployer.sendTransaction({
      to: sender,
      value: ethers.parseEther("1.0")
    });
    await tx1.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.eq(ethers.parseEther("2.0"));

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, '0x', entrypoint, validator);

    // receive eth after account created
    const tx2 = await deployer.sendTransaction({
      to: sender,
      value: ethers.parseEther("1.0")
    });
    await tx2.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lt(ethers.parseEther("3.0"));

    // send 0.5 ETH
    const callData = await buildAccountExecData(
      receiver, ethers.parseEther("0.5")
    );
    await callWithEntryPoint(sender, '0x', callData, entrypoint, validator);
    expect(
      await ethers.provider.getBalance(receiver)
    ).to.eq(ethers.parseEther("0.5"));
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lt(ethers.parseEther("2.5"));
  
    // send 0.5 ETH again
    await callWithEntryPoint(sender, '0x', callData, entrypoint, validator);
    expect(
      await ethers.provider.getBalance(receiver)
    ).to.eq(ethers.parseEther("1.0"));
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lt(ethers.parseEther("2.0"));
  });

  it("Should hold and transfer ERC1155 successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();
    const deployed = await deployments.deploy("TestHexlinkERC1155", {
      from: deployer.address,
      log: true,
      autoMine: true,
    });
    const erc1155 = TestHexlinkERC1155__factory.connect(
      deployed.address, hre.ethers.provider);

    // receive erc1155 before account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, '0x'
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, '0x', entrypoint, validator);

    // receive erc1155 after account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, '0x'
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(20);

    // send erc1155
    const erc1155Data = erc1155.interface.encodeFunctionData(
      "safeTransferFrom",
      [sender, receiver, 1, 10, '0x']
    );
    const callData = await buildAccountExecData(
      await erc1155.getAddress(), 0, erc1155Data);
    await callWithEntryPoint(sender, '0x', callData, entrypoint, validator);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);
    expect(await erc1155.balanceOf(receiver, 1)).to.eq(10);
  });

  it("Should not execute if the validator doesn't match the signer", async function() {
    const { deployer, tester, validator } = await hre.ethers.getNamedSigners();

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, '0x', entrypoint, validator);

    // get first factor and check
    const nsContract = await ethers.getContractAt(
      "SimpleNameService",
      await hexlink.getNameService()
    );
    const account = await ethers.getContractAt("Account", sender);
    const owner = await account.getNameOwner();
    expect(await account.getSecondFactor()).to.eq(ethers.ZeroAddress);
    expect(owner).to.eq(await nsContract.defaultOwner());

    // receive tokens after account created
    const erc20 = await deployErc20();
    await expect(
      erc20.connect(deployer).transfer(sender, 5000)
    ).to.emit(erc20, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await erc20.balanceOf(sender)).to.eq(5000);

    // should not execute
    const erc20Data = erc20.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(
      await erc20.getAddress(), 0, erc20Data);
    await expect(
      callWithEntryPoint(sender, '0x', callData, entrypoint, tester)
    ).to.be.reverted;
  });

  it("second factor", async function() {
    const { deployer, validator, tester } = await hre.ethers.getNamedSigners();

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, '0x', entrypoint, validator);
    const erc20 = await deployErc20();
    await erc20.connect(deployer).transfer(sender, 5000);
    expect(await erc20.balanceOf(sender)).to.eq(5000);

    // add second factor
    const account = await ethers.getContractAt("Account", sender);
    await expect(account.addSecondFactor(tester.address)).to.be.reverted;
    const callData1 = await buildAccountExecData(
      await account.getAddress(),
      0,
      account.interface.encodeFunctionData(
        "addSecondFactor",
        [tester.address]
      )
    );
    await callWithEntryPoint(sender, '0x', callData1, entrypoint, validator);

    // check 2fa settings
    expect(await account.getSecondFactor()).to.eq(tester.address);

    // erc20 transfer with 2fa enabled
    const erc20Data = erc20.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(
      await erc20.getAddress(), 0, erc20Data);

    // should not execute with first factor only
    await expect(
      callWithEntryPoint(sender, '0x', callData, entrypoint, validator)
    ).to.be.reverted;
    // should not execute with second factor only
    await expect(
      callWithEntryPoint(sender, '0x', callData, entrypoint, tester)
    ).to.be.reverted;
    // should not execute with wrong second factor
    await expect(
      call2faWithEntryPoint(sender, '0x', callData, entrypoint, validator, deployer)
    ).to.be.reverted;

    // should execute with both factors
    await call2faWithEntryPoint(sender, '0x', callData, entrypoint, validator, tester);
    expect(await erc20.balanceOf(sender)).to.eq(0);
    expect(await erc20.balanceOf(receiver)).to.eq(5000);

    // remove second factor
    await expect(account.removeSecondFactor(tester.address)).to.be.reverted;
    const callData2 = await buildAccountExecData(
      await account.getAddress(),
      0,
      account.interface.encodeFunctionData(
        "removeSecondFactor",
        [tester.address]
      )
    );
    await expect(
      callWithEntryPoint(sender, '0x', callData2, entrypoint, validator)
    ).to.be.reverted;
    await call2faWithEntryPoint(sender, '0x', callData2, entrypoint, validator, tester);

    // check factors
    expect(await account.getSecondFactor()).to.eq(ethers.ZeroAddress);
  });
});
