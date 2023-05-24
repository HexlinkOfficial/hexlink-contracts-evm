import {expect} from "chai";
import { ethers, deployments } from "hardhat";

const getValidator = async function() {
  const deployment = await deployments.get("NameValidator");
  return await ethers.getContractAt("NameValidator", deployment.address);
};

describe("NameRegistry", function() {
  let admin: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    admin = (await deployments.get("HexlinkAdmin")).address
  });

  it("signature check", async function() {
    const { validator, deployer } = await ethers.getNamedSigners();
    const nameValidator = await getValidator();
    const name = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("mailto:alice@gmail.com")
    );
    const requestInfo = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("request")
    );
    const message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32"],
        [name, requestInfo]
      )
    );
    const signature = await validator.signMessage(
        ethers.utils.arrayify(message)
    );
    expect(
        await nameValidator.validate(name, requestInfo, signature)
    ).to.be.eq(0);

    const invalidSignature = await deployer.signMessage(
      ethers.utils.arrayify(message)
    );
    expect(
      await nameValidator.validate(name, requestInfo, invalidSignature)
    ).to.be.eq(1);
  });
});