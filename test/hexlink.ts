import {expect} from "chai";
import * as hre from "hardhat";
import {ethers, deployments, getNamedAccounts, run} from "hardhat";
import { Contract } from "ethers";
import { hash, buildAuthProof } from "../tasks/utils";
import { senderName, senderNameHash, receiverName } from "./testers";
import { buildAccountInitData } from "./account";

describe("Hexlink", function() {
  let hexlink: Contract;
  let admin: string;
  let sender: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    const hexlinkProxy = await run("deployHexlinkProxy", {});
    hexlink = await ethers.getContractAt("Hexlink", hexlinkProxy);
    admin = (await deployments.get("HexlinkAdmin")).address
    sender = await hexlink.ownedAccount(senderNameHash);
  });

  it("should with proper name registry set", async function() {
    const schema = hash("mailto");
    const domain = hash("gmail.com");
    const registry = await deployments.get("EmailNameRegistry");
    expect(
      await hexlink.getRegistry(schema, domain)
    ).to.eq(registry.address);

    const {deployer, validator} = await getNamedAccounts();
    const gmailRegistry = await deployments.deploy(
      "GmailNameRegistry",
      {
          from: deployer,
          contract: "NameRegistry",
          args: [
            hash("mailto"),
            hash("gmail.com"),
            admin,
            [validator]
          ],
          log: true,
          autoMine: true
      }
    );
    await expect(
      hexlink.setRegistry(schema, domain, gmailRegistry.address)
    ).to.be.reverted;

    await run("admin_schedule_and_exec", {
      target: hexlink.address,
      data: hexlink.interface.encodeFunctionData(
        "setRegistry", [gmailRegistry.address]
      ),
      admin
    });

    expect(
      await hexlink.getRegistry(schema, domain)
    ).to.eq(gmailRegistry.address);

    expect(
      await hexlink.getRegistry(schema, hash("outlook.com"))
    ).to.eq(registry.address);
  });

  it("should upgrade successfully", async function() {
    // deploy new hexlink impl
    const {deployer} = await getNamedAccounts();
    const newHexlinkImpl = await deployments.deploy("HexlinkV2ForTest", {
      from: deployer,
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
    await run("admin_schedule_and_exec", {target: hexlink.address, data, admin});

    const hexlinkV2 = await ethers.getContractAt(
      "HexlinkV2ForTest",
      hexlink.address
    );
    expect(
      await hexlinkV2.implementation()
    ).to.eq(newHexlinkImpl.address);
    expect(
      await hexlinkV2.ownedAccount(senderNameHash)
    ).to.eq(sender);
    expect(
      await hexlinkV2.name()
    ).to.eq("HexlinkV2ForTest");
  });

  it("should deploy account contract", async function() {
    const { deployer, validator } = await ethers.getNamedSigners();
    expect(await ethers.provider.getCode(sender)).to.eq("0x");

    // deploy with invalid proof
    const validData = await buildAccountInitData(deployer.address);
    const invalidAuthProof = await buildAuthProof(
      hre,
      senderNameHash,
      validData,
      "deployer",
      hexlink.address
    );
    const invalidData = await buildAccountInitData(validator.address);
    await expect(
      hexlink.deploy(
        senderName,
        ethers.constants.AddressZero,
        invalidData,
        invalidAuthProof
      )
    ).to.be.revertedWith("name validation error 2");
  
    // deploy with invalid owner
    const proof = await buildAuthProof(
      hre,
      senderNameHash,
      validData,
      "validator",
      hexlink.address
    );
    await expect(
      hexlink.deploy(
        senderName,
        ethers.constants.AddressZero,
        invalidData,
        proof
      )
    ).to.be.reverted;

    // deploy with invalid name
    await expect(
      hexlink.deploy(
        receiverName,
        ethers.constants.AddressZero,
        validData,
        proof
      )
    ).to.be.reverted;
  
    //deploy account contract
    await expect(
      hexlink.deploy(
        senderName,
        ethers.constants.AddressZero,
        validData,
        proof
      )
    ).to.emit(hexlink, "Deployed").withArgs(
      senderNameHash, sender
    );
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");

    // check owner
    const account = await ethers.getContractAt("Account", sender);
    expect(await account.owner()).to.eq(deployer.address);

    // redeploy should throw
    const proof2 = await buildAuthProof(
      hre,
      senderNameHash,
      validData,
      "validator",
      hexlink.address
    );
    await expect(
      hexlink.connect(deployer).deploy(
        senderName,
        ethers.constants.AddressZero,
        validData,
        proof2
      )
    ).to.be.revertedWith("ERC1167: create2 failed");
  });
});
