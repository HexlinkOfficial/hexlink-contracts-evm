import {expect} from "chai";
import * as hre from "hardhat";
import {ethers, deployments, getNamedAccounts, run} from "hardhat";
import { BigNumberish, Contract } from "ethers";
import { resolveProperties } from 'ethers/lib/utils'
import { hash, buildAuthProof } from "../tasks/utils";
import { senderName, senderNameHash, receiverName } from "./testers";
import { buildAccountInitData } from "./account";
import {
  UserOperationStruct
} from '@account-abstraction/contracts'

export const buildAccountExecData = async (
  target: string,
  value?: BigNumberish,
  data?: string
) => {
  const artifact = await hre.artifacts.readArtifact("Account");
  const iface = new ethers.utils.Interface(artifact.abi);
  return iface.encodeFunctionData("exec", [target, value ?? 0, data ?? []]);
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
        invalidData,
        proof
      )
    ).to.be.reverted;

    // deploy with invalid name
    await expect(
      hexlink.deploy(
        receiverName,
        validData,
        proof
      )
    ).to.be.reverted;
  
    //deploy account contract
    await expect(
      hexlink.deploy(
        senderName,
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
        validData,
        proof2
      )
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

    const accountInitData = await buildAccountInitData(deployer.address)
    const proof = await buildAuthProof(
      hre,
      senderNameHash,
      accountInitData,
      "validator",
      hexlink.address
    );
    const initData = hexlink.interface.encodeFunctionData(
      "deploy", [senderName, accountInitData, proof]
    );
    const initCode = ethers.utils.solidityPack(
      ["address", "bytes"],
      [hexlink.address, initData]
    );

    // build user op to deploy and send eth
    const fee = await ethers.provider.getFeeData();
    const callData = await buildAccountExecData(
      deployer.address,
      ethers.utils.parseEther("0.5"),
    );

    const userOp: UserOperationStruct = {
      sender,
      nonce: 0,
      initCode,
      callData,
      callGasLimit: 500000,
      verificationGasLimit: 2000000,
      preVerificationGas: 0,
      maxFeePerGas: fee.maxFeePerGas?.toNumber() ?? 0,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas?.toNumber() ?? 0,
      paymasterAndData: [],
      signature: [],
    };
    const op = await resolveProperties(userOp);
    const opHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        [
          'address',
          'uint256',
          'bytes32',
          'bytes32',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'bytes32',
        ],
        [
          op.sender,
          op.nonce,
          ethers.utils.keccak256(op.initCode),
          ethers.utils.keccak256(op.callData),
          op.callGasLimit,
          op.verificationGasLimit,
          op.preVerificationGas,
          op.maxFeePerGas,
          op.maxPriorityFeePerGas,
          ethers.utils.keccak256(op.paymasterAndData)
        ]
      )
    );
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const userOpHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "uint256"],
        [opHash, entrypoint.address, chainId]
      )
    );
    const signature = await deployer.signMessage(
      ethers.utils.arrayify(userOpHash)
    );
    const signed = { ...userOp, signature, };
    await entrypoint.handleOps([signed], deployer.address);

    // check account
    expect(await ethers.provider.getCode(sender)).to.not.eq("0x");
    const account = await ethers.getContractAt("Account", sender);
    expect(await account.owner()).to.eq(deployer.address);
    expect(
      await ethers.provider.getBalance(sender)
    ).to.lte(ethers.utils.parseEther("0.5"));
  });
});
