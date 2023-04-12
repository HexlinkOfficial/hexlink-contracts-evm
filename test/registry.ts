import {expect} from "chai";
import {
  ethers,
  deployments,
  getNamedAccounts,
  run,
} from "hardhat";

const getRegistry = async function() {
  const deployment = await deployments.get("EmailNameRegistry");
  return await ethers.getContractAt("NameRegistry", deployment.address);
};

describe("NameRegistry", function() {
  let admin: string;

  beforeEach(async function() {
    await deployments.fixture(["TEST"]);
    const result = await run("deployAll", {});
    admin = result.admin;
  });

  it("validator should be registered", async function() {
    const { validator } = await getNamedAccounts();
    const registry = await getRegistry();
    expect(await registry.isRegistered(validator)).to.be.true;

    await expect(
      registry.registerValidator(validator, false)
    ).to.be.reverted;

    await run("admin_schedule_and_exec", {
      target: registry.address,
      data: registry.interface.encodeFunctionData(
        "registerValidator", [validator, false]
      ),
      admin
    });
    expect(await registry.isRegistered(validator)).to.be.false;
  });

  it("signature check", async function() {
    const { validator, deployer } = await ethers.getNamedSigners();
    const registry = await getRegistry();
    const name = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("mailto:alice@gmail.com")
    );
    const requestInfo = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("request")
    );
    const expiredAt = Math.floor(Date.now() / 1000) + 3600;
    const message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "uint256", "address"],
        [name, requestInfo, expiredAt, validator.address]
      )
    );
    const signature = await validator.signMessage(
        ethers.utils.arrayify(message)
    );
    const proof = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "bytes"],
        [expiredAt, validator.address, signature]
    );
    expect(
        await registry.validateName(name, requestInfo, proof)
    ).to.be.eq(0);

    const invalidExpiredAtProof = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "bytes"],
      [expiredAt - 7200, validator.address, signature]
    );
    expect(
      await registry.validateName(name, requestInfo, invalidExpiredAtProof)
    ).to.be.eq(1);

    const invalidValidatorProof = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "bytes"],
      [expiredAt, deployer.address, signature]
    );
    expect(
      await registry.validateName(name, requestInfo, invalidValidatorProof)
    ).to.be.eq(2);
  
    const invalidSignature = await deployer.signMessage(
      ethers.utils.arrayify(message)
    );
    const invalidSignatureProof = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "address", "bytes"],
      [expiredAt, validator.address, invalidSignature]
    );
    expect(
      await registry.validateName(name, requestInfo, invalidSignatureProof)
    ).to.be.eq(3);
  });
});