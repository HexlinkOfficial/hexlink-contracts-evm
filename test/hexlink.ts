import {expect} from "chai";
import {ethers, deployments, getNamedAccounts, run} from "hardhat";
import { Contract } from "ethers";
import { hash } from "../tasks/utils";

const sender = hash("mailto:sender@gmail.com");
const receiver = hash("mailto:receiver@gmail.com");

describe("Hexlink", function() {
  let hexlink: Contract;
  let admin: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    const result = await run("deployAll", {});
    hexlink = await ethers.getContractAt("Hexlink", result.hexlinkProxy);
    admin = result.admin;
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
    const senderAddr = await hexlink.ownedAccount(sender);

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
      await hexlinkV2.ownedAccount(sender)
    ).to.eq(senderAddr);
    expect(
      await hexlinkV2.name()
    ).to.eq("HexlinkV2ForTest");
  });

  it("should deploy account contract", async function() {
    const { deployer, validator } = await ethers.getNamedSigners();
    const name = {
      schema: hash("mailto"),
      domain: hash("gmail.com"),
      name: sender
    };
    const accountAddr = await hexlink.ownedAccount(name.name);
    expect(await ethers.provider.getCode(accountAddr)).to.eq("0x");

    // deploy with invalid proof
    let invalidAuthProof = await run("build_deploy_auth_proof", {
      name: name.name,
      owner: deployer.address,
      validator: "deployer",
      hexlink: hexlink.address,
    });
    await expect(
      hexlink.deploy(name, validator.address, invalidAuthProof)
    ).to.be.revertedWith("name validation error 2");
  
    // deploy with invalid owner
    const proof = await run("build_deploy_auth_proof", {
      name: name.name,
      owner: deployer.address,
      validator: "validator",
      hexlink: hexlink.address,
    });
    await expect(
      hexlink.deploy(name, validator.address, proof)
    ).to.be.reverted;

    // deploy with invalid name
    await expect(
      hexlink.deploy({
        schema: hash("mailto"),
        domain: hash("gmail.com"),
        name: receiver,
      }, deployer.address, proof)
    ).to.be.reverted;
  
    //deploy account contract
    await expect(
      hexlink.deploy(name, deployer.address, proof)
    ).to.emit(hexlink, "Deployed").withArgs(
      name.name, accountAddr
    );
    expect(await ethers.provider.getCode(accountAddr)).to.not.eq("0x");

    // check owner
    const account = await ethers.getContractAt("Account", accountAddr);
    expect(await account.owner()).to.eq(deployer.address);

    // redeploy should throw
    const authProof2 = await run("build_deploy_auth_proof", {
      name: name.name,
      owner: deployer.address,
      validator: "validator",
      hexlink: hexlink.address,
    });
    await expect(
      hexlink.connect(deployer).deploy(name, deployer.address, authProof2)
    ).to.be.revertedWith("ERC1167: create2 failed");
  });
});
