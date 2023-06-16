import {expect} from "chai";
import { ethers, deployments } from "hardhat";
import { EMAIL_NAME_TYPE, SENDER_NAME_HASH } from "./testers";

const getAuthModule = async function() {
  const deployment = await deployments.get("AuthModule");
  return await ethers.getContractAt("AuthModule", deployment.address);
};

describe("AuthModule", function() {
  let admin: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    admin = (await deployments.get("HexlinkAdmin")).address
  });

  it("signature check", async function() {
    const { validator, deployer } = await ethers.getNamedSigners();
    const module = await getAuthModule();
    await module.setName(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
    const [nameType, name] = await module.getNameInfo();
    expect(nameType).to.eq(EMAIL_NAME_TYPE);
    expect(name).to.eq(SENDER_NAME_HASH);
    const requestInfo = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("request")
    );
    const message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "bytes32"],
        [EMAIL_NAME_TYPE, SENDER_NAME_HASH, requestInfo]
      )
    );
    const signature = await validator.signMessage(
        ethers.utils.arrayify(message)
    );
    expect(
        await module.validate(requestInfo, signature)
    ).to.be.eq(0);

    const invalidSignature = await deployer.signMessage(
      ethers.utils.arrayify(message)
    );
    expect(
      await module.validate(requestInfo, invalidSignature)
    ).to.be.eq(1);
  });
});