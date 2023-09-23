import { expect } from "chai";
import { ethers, deployments, run } from "hardhat";
import * as hre from "hardhat";
import {
  SENDER_NAME_HASH,
  buildAccountExecData,
  callWithEntryPoint,
  genInitCode
} from "./testers";
import { getHexlink, getValidator } from "../tasks/utils";
import { deploySender } from "./account";
import {
  EntryPoint__factory,
  Hexlink,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Hexlink", function() {
  let hexlink: Hexlink;
  let admin: string;
  let sender: string;
  let deployer: HardhatEthersSigner;

  beforeEach(async function() {
    const signers = await ethers.getNamedSigners();
    deployer = signers.deployer;
    await deployments.fixture(["TEST"]);
    hexlink = (await getHexlink(hre)).connect(deployer);

    admin = (await deployments.get("HexlinkAdmin")).address
    sender = await hexlink.getOwnedAccount(SENDER_NAME_HASH);
  });

  it("should set with name service and auth registry", async function() {
    const ns = await hre.deployments.get("SimpleNameService");
    expect(
      await hexlink.getNameService()
    ).to.eq(ns.address);

    const authRegistry = await hre.deployments.get("AuthRegistry");
    expect(
      await hexlink.getAuthRegistry()
    ).to.eq(authRegistry.address);

    const validator = await getValidator(hre);
    const nsContract = await ethers.getContractAt("SimpleNameService", ns.address);
    expect(await nsContract.defaultOwner()).to.eq(validator);
  });

  it("should upgrade account implementation successfully", async function() {
    const {deployer} = await ethers.getNamedSigners();
    expect(await hexlink.getLatestVersion()).to.eq(1);
    const impl1 = await hexlink.getAccountImplementation();
    const account = await deploySender(hexlink);
    const impl2 = (await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer.address,
        args: [await account.entryPoint(), await account.getERC4972Registry()]
      }
    )).address;
    const data = hexlink.interface.encodeFunctionData(
      "upgradeImplementation",
      [impl2]
    );
    await run(
      "admin_schedule_and_exec",
      {target: await hexlink.getAddress(), data, admin}
    );

    expect(await hexlink.getAccountImplementation()).to.eq(impl2);
    expect(await hexlink.getLatestVersion()).to.eq(2);
    expect(await hexlink.getImplementation(1)).to.eq(impl1);
    expect(await hexlink.getImplementation(2)).to.eq(impl2);
    
    await expect(hexlink.getImplementations(2, 1)).to.be.reverted;
    const impls = await hexlink.getImplementations(1, 2);
    expect(impls.length).to.eq(2);
    expect(impls[0]).to.eq(impl1);
    expect(impls[1]).to.eq(impl2);
  });

  it("should upgrade successfully", async function() {
    // deploy new hexlink impl
    const {deployer} = await ethers.getNamedSigners();
    const ns = await hre.deployments.get("SimpleNameService");
    const authRegistry = await hre.deployments.get("AuthRegistry");
    const newHexlinkImpl = await deployments.deploy(
      "HexlinkV2ForTest", {
        from: deployer.address,
        args: [ns.address, authRegistry.address],
        log: true,
        autoMine: true,
    });
    const hexlinkAddr = await hexlink.getAddress();

    // upgrade
    const hexlinkProxy = await ethers.getContractAt(
      "HexlinkERC1967Proxy",
      hexlinkAddr
    );
    await expect(
      hexlinkProxy.initProxy(newHexlinkImpl.address, '0x')
    ).to.be.reverted;

    const data = hexlink.interface.encodeFunctionData(
      "upgradeTo",
      [newHexlinkImpl.address]
    );
    await run(
      "admin_schedule_and_exec",
      {target: hexlinkAddr, data, admin}
    );

    const hexlinkV2 = await ethers.getContractAt(
      "HexlinkV2ForTest",
      hexlinkAddr
    );
    expect(
      await hexlinkV2.implementation()
    ).to.eq(newHexlinkImpl.address);
    expect(
      await hexlinkV2.getOwnedAccount(SENDER_NAME_HASH)
    ).to.eq(sender);
    expect(
      await hexlinkV2.name()
    ).to.eq("HexlinkV2ForTest");
  });

  it("should deploy account contract", async function() {
    const { deployer } = await ethers.getNamedSigners();
    expect(await ethers.provider.getCode(sender)).to.eq("0x");

    // deploy account contract
    await expect(
      hexlink.deploy(SENDER_NAME_HASH)
    ).to.emit(hexlink, "AccountDeployed").withArgs(
      SENDER_NAME_HASH, sender
    );
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");

    // redeploy should throw
    await expect(
      hexlink.deploy(SENDER_NAME_HASH)
    ).to.be.revertedWith("ERC1167: create2 failed");
  });

  it("should deploy account with erc4337 entrypoint", async function() {
    const { deployer, validator } = await ethers.getNamedSigners();
    const entrypoint = EntryPoint__factory.connect(
      (await deployments.get("EntryPoint")).address,
      ethers.provider
    );
    expect(await ethers.provider.getCode(sender)).to.eq("0x");
    // deposit eth before account created
    await deployer.sendTransaction({
      to: sender,
      value: ethers.parseEther("1.0")
    });

    const initCode = await genInitCode(hexlink);
    const callData = await buildAccountExecData(
      deployer.address,
      ethers.parseEther("0.5"),
    );

    await callWithEntryPoint(sender, initCode, callData, entrypoint, validator);
    // check account
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lte(ethers.parseEther("0.5"));
  });
});
