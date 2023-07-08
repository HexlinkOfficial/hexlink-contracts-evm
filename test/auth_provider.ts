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

  it("test simple auth provider", async function() {
    const {validator} = await hre.getNamedAccounts();
    const provider = await getDeployedContract(hre, 'SimpleAuthProvider');
    expect(await provider.getValidator(sender)).to.eq(validator);
    expect(await provider.getDefaultValidator()).to.eq(validator);
  });

  it("test simple auth provider", async function() {
    const {deployer, validator} = await hre.getNamedAccounts();
    await hre.deployments.deploy('EnsAuthProvider', {
      from: deployer,
      args: [validator],
      log: true,
      autoMine: true,
    });
    const provider = await getDeployedContract(hre, 'EnsAuthProvider');
    expect(await provider.getDefaultValidator()).to.eq(ethers.constants.AddressZero);
    expect(await provider.getMetadata()).to.eq("");
  });
});