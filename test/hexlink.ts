import { expect } from "chai";
import { ethers, deployments, run } from "hardhat";
import * as hre from "hardhat";
import { Contract } from "ethers";
import {
  EMAIL_NAME_TYPE,
  SENDER_NAME_HASH,
  buildAccountExecData,
  callWithEntryPoint,
  genInitCode
} from "./testers";
import { getHexlink, getValidator, hash } from "../tasks/utils";

describe("Hexlink", function() {
  let hexlink: Contract;
  let admin: string;
  let sender: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    hexlink = await getHexlink(hre);
    await hre.run("set_auth_providers", []);
    await hre.run("upgrade_account", []);
    admin = (await deployments.get("HexlinkAdmin")).address
    sender = await hexlink.getOwnedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
  });

  it("should set with provider auth provider and validator", async function() {
    const authProvider = await hre.deployments.get("SimpleAuthProvider");
    expect(
      await hexlink.getAuthProvider(hash("mailto"))
    ).to.eq(authProvider.address);
    expect(
      await hexlink.getAuthProvider(hash("tel"))
    ).to.eq(authProvider.address);

    const validator = await getValidator(hre);
    expect(
      await hexlink.getDefaultValidator(hash("mailto"))
    ).to.eq(validator);
    expect(
      await hexlink.getDefaultValidator(hash("tel"))
    ).to.eq(validator);
  });

  it("should upgrade successfully", async function() {
    // deploy new hexlink impl
    const {deployer} = await ethers.getNamedSigners();
    const newHexlinkImpl = await deployments.deploy(
      "HexlinkV2ForTest", {
        from: deployer.address,
        args: [],
        log: true,
        autoMine: true,
    });

    // upgrade
    const hexlinkProxy = await ethers.getContractAt(
      "HexlinkERC1967Proxy",
      hexlink.address
    );
    await expect(
      hexlinkProxy.initProxy(newHexlinkImpl.address, [])
    ).to.be.reverted;

    const data = hexlink.interface.encodeFunctionData(
      "upgradeTo",
      [newHexlinkImpl.address]
    );
    await run(
      "admin_schedule_and_exec",
      {target: hexlink.address, data, admin}
    );

    const hexlinkV2 = await ethers.getContractAt(
      "HexlinkV2ForTest",
      hexlink.address
    );
    expect(
      await hexlinkProxy.implementation()
    ).to.eq(newHexlinkImpl.address);
    expect(
      await hexlinkV2.getOwnedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
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
      hexlink.deploy(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
    ).to.emit(hexlink, "AccountDeployed").withArgs(
      EMAIL_NAME_TYPE, SENDER_NAME_HASH, sender
    );
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");

    // redeploy should throw
    await expect(
      hexlink.deploy(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
    ).to.be.revertedWith("ERC1167: create2 failed");
  });

  it("should deploy account with erc4337 entrypoint", async function() {
    const { deployer } = await ethers.getNamedSigners();
    const entrypoint = await ethers.getContractAt(
      "EntryPoint",
      (await deployments.get("EntryPoint")).address
    );
    expect(await ethers.provider.getCode(sender)).to.eq("0x");
    // deposit eth before account created
    await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });

    const initCode = await genInitCode(hexlink);
    const callData = await buildAccountExecData(
      deployer.address,
      ethers.utils.parseEther("0.5"),
    );
    await callWithEntryPoint(sender, initCode, callData, entrypoint);
    // check account
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lte(ethers.utils.parseEther("0.5"));
  });
});
