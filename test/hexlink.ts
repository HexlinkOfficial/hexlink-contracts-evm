import {expect} from "chai";
import {ethers, deployments, run} from "hardhat";
import { Contract } from "ethers";
import { EMAIL_NAME_TYPE, SENDER_NAME_HASH } from "./testers";
import { buildAccountExecData, call } from "./account";
import { getEntryPoint } from "../tasks/deploy";

export const genInitCode = async (hexlink: Contract) => {
  const initData = hexlink.interface.encodeFunctionData(
    "deploy", [EMAIL_NAME_TYPE, SENDER_NAME_HASH]
  );
  return ethers.utils.solidityPack(
    ["address", "bytes"],
    [hexlink.address, initData]
  );
}

describe("Hexlink", function() {
  let hexlink: Contract;
  let admin: string;
  let sender: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    const hexlinkProxy = await run("deployHexlinkProxy", {});
    hexlink = await ethers.getContractAt("Hexlink", hexlinkProxy);
    admin = (await deployments.get("HexlinkAdmin")).address
    sender = await hexlink.ownedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
  });

  it("should upgrade successfully", async function() {
    // deploy new hexlink impl
    const {deployer} = await ethers.getNamedSigners();
    const account = await deployments.get("Account");
    const authModule = await deployments.get("DefaultAuthModule");
    const entrypoint = await deployments.get("EntryPoint");
    const newHexlinkImpl = await deployments.deploy("HexlinkV2ForTest", {
      from: deployer.address,
      args: [account.address, authModule.address, entrypoint.address],
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
    await run("admin_schedule_and_exec", {target: hexlink.address, data, admin});

    const hexlinkV2 = await ethers.getContractAt(
      "HexlinkV2ForTest",
      hexlink.address
    );
    expect(
      await hexlinkProxy.implementation()
    ).to.eq(newHexlinkImpl.address);
    expect(
      await hexlinkV2.ownedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
    ).to.eq(sender);
    expect(
      await hexlinkV2.name()
    ).to.eq("HexlinkV2ForTest");
  });

  it("should deploy account contract", async function() {
    const { deployer } = await ethers.getNamedSigners();
    expect(await ethers.provider.getCode(sender)).to.eq("0x");

    //deploy account contract
    await expect(
      hexlink.deploy(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
    ).to.emit(hexlink, "Deployed").withArgs(
      EMAIL_NAME_TYPE, SENDER_NAME_HASH, sender
    );
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");

    // redeploy should throw
    await expect(
      hexlink.connect(deployer).deploy(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
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
    await call(sender, initCode, callData, entrypoint);

    // check account
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lte(ethers.utils.parseEther("0.5"));
  });
});
