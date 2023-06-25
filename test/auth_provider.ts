import { expect } from "chai";
import * as hre from "hardhat";
import { EMAIL_NAME_TYPE, SENDER_NAME_HASH, TEL_NAME_TYPE } from "./testers";
import { getDeployedContract, hash} from "../tasks/utils";
import { ethers } from "ethers";

describe("AuthProviderTest", function() {

  beforeEach(async function() {
    await hre.deployments.fixture(["TEST"]);
  });

  it("test encode and decode", async function() {
    const {deployer} = await hre.ethers.getNamedSigners();
    const deployed = await hre.deployments.deploy("AuthProviderTest", {
      from: deployer.address,
      args: [],
      log: true,
      autoMine: true,
    });
    const tester = await hre.ethers.getContractAt(
      "AuthProviderTest",
      deployed.address
    );

    // IAuthProvider
    const dAuth = await hre.deployments.get("DAuthAuthProvider");
    const encoded1 = await tester.testEncode({
      provider: dAuth.address,
      providerType: 0,
    });
    const decode1 = await tester.testDecode(encoded1);
    expect(decode1.provider).to.eq(dAuth.address);
    expect(decode1.providerType).to.eq(0);
  
    // EOA
    const encoded2 = await tester.testEncode({
      provider: deployer.address,
      providerType: 1,
    });
    const decode2 = await tester.testDecode(encoded2);
    expect(decode2.provider).to.eq(deployer.address);
    expect(decode2.providerType).to.eq(1);
  });

  it("test dauth auth provider", async function() {    
    const provider = await getDeployedContract(hre, 'DAuthAuthProvider');
    const registry = await hre.ethers.getContractAt(
      "DAuthRegistryTest",
      provider.registry()
    );

    const validator = await registry.getValidator();
    expect(await registry.isValidatorRegistered(validator)).to.be.true;
    expect(
      await provider.isValidSigner(EMAIL_NAME_TYPE, SENDER_NAME_HASH, validator)
    ).to.be.true;
    expect(
      await provider.isValidSigner(
        EMAIL_NAME_TYPE,
        SENDER_NAME_HASH,
        ethers.constants.AddressZero
      )
    ).to.be.false;
  
    expect(await provider.isSupportedNameType(EMAIL_NAME_TYPE)).to.be.true;
    expect(await provider.isSupportedNameType(TEL_NAME_TYPE)).to.be.true;
    expect(await provider.isSupportedNameType(hash("ens"))).to.be.false;
    expect(await provider.isSupportedNameType(ethers.constants.HashZero)).to.be.false;
  });
});