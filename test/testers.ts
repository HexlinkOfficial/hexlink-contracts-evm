import * as hre from "hardhat";
import { hash } from "../tasks/utils";
import { ethers } from "hardhat";
import { Contract, BigNumberish, BigNumber, Signer } from "ethers";
import { UserOperationStruct } from '@account-abstraction/contracts'
import { resolveProperties } from 'ethers/lib/utils'

export const SENDER_NAME_HASH = hash("mailto:sender@gmail.com");
export const RECEIVER_NAME_HASH = hash("mailto:receiver@gmail.com");

export const genInitCode = async (hexlink: Contract) => {
    const initData = hexlink.interface.encodeFunctionData(
      "deploy", [SENDER_NAME_HASH]
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
    return iface.encodeFunctionData("execute", [
      target,
      value ?? 0,
      data ?? []
    ]);
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
  const now = Math.floor(Date.now() / 1000) - 5;
  return BigNumber.from(now + 3600).add(
      BigNumber.from(now).shl(48)
  );
}

export const callWithEntryPoint = async (
  sender: string,
  initCode: string | [],
  callData: string | [],
  entrypoint: Contract,
  signer: any,
  logError: boolean = false
) => {
  const [userOp, userOpHash] = await genUserOp(sender, initCode, callData, entrypoint);
  const validation = genValidationData();
  let message = ethers.utils.solidityKeccak256(
    ["uint8", "uint96", "bytes32"],
    [0, validation, userOpHash]
  );
  message = ethers.utils.solidityKeccak256(
    ["bytes32", "bytes32"],
    [SENDER_NAME_HASH, message]
  );
  let signature = await signer.signMessage(
    ethers.utils.arrayify(message)
  );
  signature = ethers.utils.solidityPack(
    ["uint8", "uint96", "bytes"],
    [0, validation, signature]
  );
  const signed = { ...userOp, signature, };
  try {
    await entrypoint.handleOps([signed], signer.address);
  } catch (e: any) {
    if (logError && e.message) {
      const match = e.message.match(/0x[0-9a-z]+/);
      if (match) {
        console.log(entrypoint.interface.parseError(match[0]));
      }
    }
    throw e;
  }
}

export const call2faWithEntryPoint = async (
  sender: string,
  initCode: string | [],
  callData: string | [],
  entrypoint: Contract,
  signer1: any,
  signer2: any,
  log: boolean = false
) => {
  const [userOp, userOpHash] = await genUserOp(sender, initCode, callData, entrypoint);
  const validation = genValidationData();
  const message = ethers.utils.solidityKeccak256(
    ["uint8", "uint96", "bytes32"],
    [0, validation, userOpHash]
  );
  const messageWithName = ethers.utils.solidityKeccak256(
    ["bytes32", "bytes32"],
    [SENDER_NAME_HASH, message]
  );
  const signature1 = await signer1.signMessage(
    ethers.utils.arrayify(messageWithName)
  );
  const signature2 = await signer2.signMessage(
    ethers.utils.arrayify(message)
  );
  const signature = ethers.utils.solidityPack(
    ["uint8", "uint96", "bytes", "bytes"],
    [0, validation, signature1, signature2]
  );
  const signed = { ...userOp, signature, };
  try {
    await entrypoint.handleOps([signed], signer1.address);
  } catch (e: any) {
    if (log && e.message) {
      const match = e.message.match(/0x[0-9a-z]+/);
      if (match) {
        console.log(entrypoint.interface.parseError(match[0]));
      }
    }
    throw e;
  }
}

export const getNonce = async (sender: string) => {
    const account = await ethers.getContractAt("Account", sender);
    if (await ethers.provider.getCode(sender) === "0x") {
      return 0;
    }
    return account.getNonce();
}
