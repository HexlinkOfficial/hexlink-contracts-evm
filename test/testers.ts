import * as hre from "hardhat";
import { hash } from "../tasks/utils";
import { ethers } from "hardhat";
import { Contract, BigNumberish, BigNumber } from "ethers";
import { UserOperationStruct } from '@account-abstraction/contracts'
import { keccak256, resolveProperties } from 'ethers/lib/utils'

export const TEL_NAME_TYPE = hash("tel");
export const EMAIL_NAME_TYPE = hash("mailto");
export const SENDER_NAME_HASH = hash("sender@gmail.com");
export const RECEIVER_NAME_HASH = hash("receiver@gmail.com");

export const genInitCode = async (hexlink: Contract) => {
    const initData = hexlink.interface.encodeFunctionData(
      "deploy", [EMAIL_NAME_TYPE, SENDER_NAME_HASH]
    );
    return ethers.utils.solidityPack(
      ["address", "bytes"],
      [hexlink.address, initData]
    );
}

export const buildAccountExecData = async (
    target: string,
    value?: BigNumberish,
    data?: string
) => {
    const artifact = await hre.artifacts.readArtifact("Account");
    const iface = new ethers.utils.Interface(artifact.abi);
    return iface.encodeFunctionData("execute", [{
      target,
      value: value ?? 0,
      data: data ?? []
    }]);
}

const genUserOp = async (
  sender: string,
  initCode: string | [],
  callData: string | [],
  entrypoint: Contract
): Promise<[UserOperationStruct, string]> => {
  const fee = await ethers.provider.getFeeData();
  const userOp: UserOperationStruct = {
    sender,
    nonce: await getNonce(sender),
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
  const chainId = await hre.getChainId();
  const userOpHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [opHash, entrypoint.address, chainId]
    )
  );
  return [userOp, userOpHash];
}

function genValidationData() {
  const now = Math.floor(Date.now() / 1000);
  return BigNumber.from(now + 3600).shl(160).add(
      BigNumber.from(now).shl(208)
  );
}

export const callWithEntryPoint = async (
    sender: string,
    initCode: string | [],
    callData: string | [],
    entrypoint: Contract
) => {
    const {deployer, validator} = await hre.ethers.getNamedSigners();
    const [userOp, userOpHash] = await genUserOp(sender, initCode, callData, entrypoint);
    const validation = genValidationData();
    const message = keccak256(ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes32"], [validation, userOpHash]
    ));
    const signature = await validator.signMessage(
      ethers.utils.arrayify(message)
    );
    const authInput = ethers.utils.defaultAbiCoder.encode(
      ["tuple(uint256, address, bytes)"],
      [[validation, validator.address, signature]]
    );
    const signed = { ...userOp, signature: authInput, };
    await entrypoint.handleOps([signed], deployer.address);
}

export const callEntryPointWithTester = async (
  sender: string,
  initCode: string | [],
  callData: string | [],
  entrypoint: Contract
) => {
  const {deployer, tester} = await hre.ethers.getNamedSigners();
  const [userOp, userOpHash] = await genUserOp(sender, initCode, callData, entrypoint);
  const validation = genValidationData();
  const message = keccak256(ethers.utils.defaultAbiCoder.encode(
    ["uint256", "bytes32"], [validation, userOpHash]
  ));
  const signature = await tester.signMessage(
    ethers.utils.arrayify(message)
  );
  const authInput = ethers.utils.defaultAbiCoder.encode(
    ["tuple(uint256, address, bytes)"],
    [[validation, tester.address, signature]]
  );
  const signed = { ...userOp, signature: authInput, };
  await entrypoint.handleOps([signed], deployer.address);
}

export const getNonce = async (sender: string) => {
    const account = await ethers.getContractAt("Account", sender);
    if (await ethers.provider.getCode(sender) === "0x") {
      return 0;
    }
    return account.getNonce();
}
