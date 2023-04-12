import {expect} from "chai";
import * as hre from "hardhat";
import {ethers, deployments, getNamedAccounts, run} from "hardhat";
import { Contract } from "ethers";
import { hash, buildAuthProof } from "../tasks/utils";
import { senderName, senderNameHash, receiverName } from "./testers";

describe("Hexlink", function() {
  let hexlink: Contract;
  let admin: string;
  let sender: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    const result = await run("deployAll", {});
    hexlink = await ethers.getContractAt("Hexlink", result.hexlinkProxy);
    admin = result.admin;
    sender = await hexlink.ownedAccount(senderNameHash);
  });

  it("should with proper name registry set", async function() {
    const schema = hash("mailto");
    const domain = hash("gmail.com");
    const registry = await deployments.get("EmailNameRegistry");
    expect(
      await hexlink.getRegistry(schema, domain)
    ).to.eq(registry.address);

    const gmailRegistry = await run(
      "deployNameRegistry",
      {
        admin,
        name: "GmailNameRegistry",
        schema: "mailto",
        domain: "gmail.com"
      }
  );
    await expect(
      hexlink.setRegistry(schema, domain, gmailRegistry)
    ).to.be.reverted;

    await run("admin_schedule_and_exec", {
      target: hexlink.address,
      data: hexlink.interface.encodeFunctionData(
        "setRegistry", [gmailRegistry]
      ),
      admin
    });

    expect(
      await hexlink.getRegistry(schema, domain)
    ).to.eq(gmailRegistry);

    expect(
      await hexlink.getRegistry(schema, hash("outlook.com"))
    ).to.eq(registry.address);
  });

  it("should upgrade successfully", async function() {
    // deploy new hexlink impl
    const {deployer} = await getNamedAccounts();
    const newHexlinkImpl = await deployments.deploy("HexlinkV2ForTest", {
      from: deployer,
      args: [await hexlink.accountImplementation()],
      log: true,
      autoMine: true,
    });

    // upgrade
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
    const invalidAuthProof = await buildAuthProof(
      hre,
      senderNameHash,
      deployer.address,
      "deployer",
      hexlink.address
    );
    await expect(
      hexlink.deploy(senderName, validator.address, invalidAuthProof)
    ).to.be.revertedWith("name validation error 2");
  
    // deploy with invalid owner
    const proof = await buildAuthProof(
      hre,
      senderNameHash,
      deployer.address,
      "validator",
      hexlink.address
    );
    await expect(
      hexlink.deploy(senderName, validator.address, proof)
    ).to.be.reverted;

    // deploy with invalid name
    await expect(
      hexlink.deploy(receiverName, deployer.address, proof)
    ).to.be.reverted;
  
    //deploy account contract
    await expect(
      hexlink.deploy(senderName, deployer.address, proof)
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
      deployer.address,
      "validator",
      hexlink.address
    );
    await expect(
      hexlink.connect(deployer).deploy(
        senderName,
        deployer.address,
        proof2
      )
    ).to.be.revertedWith("ERC1167: create2 failed");
  });
});
