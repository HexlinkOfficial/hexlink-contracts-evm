import { expect } from "chai";
import { ethers, deployments, run } from "hardhat";
import * as hre from "hardhat";
import {
  SENDER_NAME_HASH,
  buildAccountExecData,
  callWithEntryPoint,
  genInitCode
} from "./testers";
import { Contract } from "ethers";
import { getHexlink } from "../tasks/utils";
import { EntryPoint__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Hexlink", function() {
  let hexlink: Contract;
  let sender: string;
  let deployer: HardhatEthersSigner;

  beforeEach(async function() {
    const signers = await ethers.getNamedSigners();
    deployer = signers.deployer;
    await deployments.fixture(["TEST"]);
    hexlink = await getHexlink(hre);
    sender = await hexlink.getAccountAddress(SENDER_NAME_HASH);
  });

  it("should upgrade successfully", async function() {
    // deploy new hexlink impl
    const {deployer, validator} = await ethers.getNamedSigners();
    expect(
      await hexlink.getValidator()
    ).to.eq(validator.address);
    const impl2 = (await deployments.deploy(
      "HexlinkAccountV2ForTest",
      {
        from: deployer.address,
        args: [
          (await deployments.get("EntryPoint")).address,
          await hexlink.getAddress()
        ]
      }
    )).address;

    const newHexlinkImpl = await deployments.deploy(
      "HexlinkV2ForTest", {
        from: deployer.address,
        args: [validator.address, impl2],
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
      {target: hexlinkAddr, data}
    );
    const hexlinkV2 = await ethers.getContractAt(
      "HexlinkV2ForTest",
      hexlinkAddr
    );
    expect(
      await hexlinkV2.implementation()
    ).to.eq(newHexlinkImpl.address);
    expect(
      await hexlinkV2.getAccountAddress(SENDER_NAME_HASH)
    ).to.eq(sender);
    expect(
      await hexlinkV2.getAccountImplementation()
    ).to.eq(impl2);
    expect(
      await hexlinkV2.name()
    ).to.eq("HexlinkV2ForTest");
  });

  it("should deploy account contract", async function() {
    const { deployer, validator } = await ethers.getNamedSigners();
    expect(await ethers.provider.getCode(sender)).to.eq("0x");
    let message = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address"],
      [
        hre.network.config.chainId,
        await hexlink.getAddress(),
        deployer.address
      ]
    );
    message = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32"],
      [SENDER_NAME_HASH, message]
    );
    const signature = await validator.signMessage(
      ethers.getBytes(message));
    // deploy account contract
    await expect(
      hexlink.deploy(SENDER_NAME_HASH, deployer.address, signature)
    ).to.emit(hexlink, "AccountDeployed").withArgs(
      SENDER_NAME_HASH, sender
    );
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");

    // redeploy should throw
    await expect(
      hexlink.deploy(SENDER_NAME_HASH, deployer.address, signature)
    ).to.be.revertedWith("ERC1167: create2 failed");
  });

  it("should deploy account with erc4337 entrypoint", async function() {
    const { deployer, validator } = await ethers.getNamedSigners();
    const entrypoint = EntryPoint__factory.connect(
      (await deployments.get("EntryPoint")).address,
      deployer
    );
    expect(await ethers.provider.getCode(sender)).to.eq("0x");
    // deposit eth before account created
    await deployer.sendTransaction({
      to: sender,
      value: ethers.parseEther("1.0")
    });

    const initCode = await genInitCode(hexlink, deployer.address, validator);
    const callData = await buildAccountExecData(
      deployer.address,
      ethers.parseEther("0.5"),
    );
    await callWithEntryPoint(sender, initCode, callData, entrypoint, deployer);
    // check account
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lte(ethers.parseEther("0.5"));
  });
});
