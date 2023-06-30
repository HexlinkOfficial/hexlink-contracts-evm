import { expect } from "chai";
import * as hre from "hardhat";
import { EMAIL_NAME_TYPE, SENDER_NAME_HASH, TEL_NAME_TYPE } from "./testers";
import { getDeployedContract, getHexlink, hash} from "../tasks/utils";
import { Contract, ethers } from "ethers";

describe("AuthProviderTest", function() {
  let hexlink: Contract;
  let sender: string;

  beforeEach(async function() {
    await hre.deployments.fixture(["TEST"]);
    hexlink = await getHexlink(hre);
    await hre.run("set_auth_providers", []);
    await hre.run("upgrade_account", []);
    sender = await hexlink.getOwnedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
  });

  it("test dauth auth provider", async function() {
    const {deployer, validator} = await hre.getNamedAccounts();
    const provider = await getDeployedContract(hre, 'DAuthAuthProvider');

    const registry = await hre.ethers.getContractAt(
      "DAuthRegistryTest",
      await provider.getRegistry()
    );
    expect(await registry.isValidatorRegistered(validator)).to.be.true;
    expect(await registry.isValidatorRegistered(deployer)).to.be.true;
    expect(await provider.getValidator(sender)).to.eq(validator);
  
    // set next provider
    const signers = await hre.ethers.getNamedSigners();
    await expect(
      provider.connect(signers.deployer).setValidator(ethers.constants.AddressZero)
    ).to.be.revertedWith("invalid validator");

    await provider.connect(signers.deployer).setValidator(deployer);
    expect(await provider.getValidator(sender)).to.eq(deployer);
  });
});