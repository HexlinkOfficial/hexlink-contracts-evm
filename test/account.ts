import { expect } from "chai";
import * as hre from "hardhat";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { Contract } from "ethers";
import {
  SENDER_NAME_HASH,
  RECEIVER_NAME_HASH,
  callWithEntryPoint,
  call2faWithEntryPoint,
  buildAccountExecData,
  genInitCode
} from "./testers";
import { getHexlink } from "../tasks/utils";

export const deploySender = async (hexlink: Contract) : Promise<Contract> => {
  const accountAddr = await hexlink.getOwnedAccount(SENDER_NAME_HASH);
  await expect(
    hexlink.deploy(SENDER_NAME_HASH)
  ).to.emit(hexlink, "AccountDeployed").withArgs(
    SENDER_NAME_HASH, accountAddr
  );
  return await ethers.getContractAt("Account", accountAddr);
}

async function deployErc20(deployer: string) {
  const deployed = await deployments.deploy("TestHexlinkERC20", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  return await ethers.getContractAt(
    "TestHexlinkERC20",
    deployed.address
  );
}

describe("Hexlink Account", function () {
  let hexlink: Contract;
  let entrypoint: Contract;
  let sender: string;
  let receiver: string;

  beforeEach(async function () {
    await deployments.fixture(["TEST"]);
    hexlink = await getHexlink(hre);
    sender = await hexlink.getOwnedAccount(SENDER_NAME_HASH);
    receiver = await hexlink.getOwnedAccount(RECEIVER_NAME_HASH);
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
    const { deployer, validator } = await hre.ethers.getNamedSigners();
    let account = await deploySender(hexlink);
    const impl2 = await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer.address,
        args: [await account.entryPoint(), await account.getERC4972Registry()]
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
    await callWithEntryPoint(sender, [], callData, entrypoint, validator)
    expect(await account.implementation()).to.eq(impl2.address);
  });

  it("Should transfer erc20 successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();
    const erc20 = await deployErc20(deployer.address);
    // receive tokens before account created
    await expect(
      erc20.connect(deployer).transfer(sender, 5000)
    ).to.emit(erc20, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await erc20.balanceOf(sender)).to.eq(5000);

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint, validator);

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
    const callData = await buildAccountExecData(erc20.address, 0, erc20Data);
    await callWithEntryPoint(sender, [], callData, entrypoint, validator);
    expect(await erc20.balanceOf(sender)).to.eq(5000);
    expect(await erc20.balanceOf(receiver)).to.eq(5000);
  });

  it("Should transfer eth successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();

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
    await callWithEntryPoint(sender, initCode, [], entrypoint, validator);

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
    await callWithEntryPoint(sender, [], callData, entrypoint, validator);
    expect(
      await ethers.provider.getBalance(receiver)
    ).to.eq(ethers.utils.parseEther("0.5").toHexString());
  });

  it("Should hold and transfer ERC1155 successfully", async function () {
    const { deployer, validator } = await hre.ethers.getNamedSigners();
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
    await callWithEntryPoint(sender, initCode, [], entrypoint, validator);

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
    await callWithEntryPoint(sender, [], callData, entrypoint, validator);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);
    expect(await erc1155.balanceOf(receiver, 1)).to.eq(10);
  });

  it("Should not execute if the validator doesn't match the signer", async function() {
    const { deployer, tester, validator } = await hre.ethers.getNamedSigners();

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint, validator);

    // get first factor and check
    const nsContract = await ethers.getContractAt(
      "SimpleNameService",
      await hexlink.getNameService()
    );
    const account = await ethers.getContractAt("Account", sender);
    const owner = await account.getNameOwner();
    expect(await account.getNumOfSecondFactors()).to.eq(0);
    expect(owner).to.eq(await nsContract.defaultOwner());

    // receive tokens after account created
    const erc20 = await deployErc20(deployer.address);
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
    const callData = await buildAccountExecData(erc20.address, 0, erc20Data);
    await expect(
      callWithEntryPoint(sender, [], callData, entrypoint, tester)
    ).to.be.reverted;
  });

  it("second factor", async function() {
    const { deployer, validator, tester } = await hre.ethers.getNamedSigners();

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint, validator);
    const erc20 = await deployErc20(deployer.address);
    await erc20.connect(deployer).transfer(sender, 5000);
    expect(await erc20.balanceOf(sender)).to.eq(5000);

    // add second factor
    const account = await ethers.getContractAt("Account", sender);
    await expect(account.addSecondFactor(tester.address)).to.be.reverted;
    const callData1 = await buildAccountExecData(
      account.address,
      0,
      account.interface.encodeFunctionData(
        "addSecondFactor",
        [tester.address]
      )
    );
    await callWithEntryPoint(sender, [], callData1, entrypoint, validator);

    // check 2fa settings
    let factors = await account.getSecondFactors();
    expect(factors[0]).to.eq(tester.address);
    expect(await account.getNumOfSecondFactors()).to.eq(factors.length).to.eq(1);

    // erc20 transfer with 2fa enabled
    const erc20Data = erc20.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(erc20.address, 0, erc20Data);

    // should not execute with first factor only
    await expect(
      callWithEntryPoint(sender, [], callData, entrypoint, validator)
    ).to.be.reverted;
    // should not execute with second factor only
    await expect(
      callWithEntryPoint(sender, [], callData, entrypoint, tester)
    ).to.be.reverted;
    // should not execute with wrong second factor
    await expect(
      call2faWithEntryPoint(sender, [], callData, entrypoint, validator, deployer)
    ).to.be.reverted;

    // should execute with both factors
    await call2faWithEntryPoint(sender, [], callData, entrypoint, validator, tester);
    expect(await erc20.balanceOf(sender)).to.eq(0);
    expect(await erc20.balanceOf(receiver)).to.eq(5000);

    // remove second factor
    await expect(account.removeSecondFactor(tester.address)).to.be.reverted;
    const callData2 = await buildAccountExecData(
      account.address,
      0,
      account.interface.encodeFunctionData(
        "removeSecondFactor",
        [tester.address]
      )
    );
    await expect(
      callWithEntryPoint(sender, [], callData2, entrypoint, validator)
    ).to.be.reverted;
    await call2faWithEntryPoint(sender, [], callData2, entrypoint, validator, tester);

    // check factors
    factors = await account.getSecondFactors();
    expect(await account.getNumOfSecondFactors()).to.eq(factors.length).to.eq(0);
  });
});
