import * as hre from "hardhat";
import { hash } from "../tasks/utils";
import { ethers } from "hardhat";
import { BigNumberish, BytesLike, AddressLike } from "ethers";
import { EntryPoint, Hexlink } from "../typechain-types";
import { Account__factory } from "../typechain-types";

export const SENDER_NAME_HASH = hash("mailto:sender@gmail.com");
export const RECEIVER_NAME_HASH = hash("mailto:receiver@gmail.com");

export const genInitCode = async (hexlink: Hexlink) => {
    const initData = hexlink.interface.encodeFunctionData(
      "deploy", [SENDER_NAME_HASH]
    );
    return ethers.solidityPacked(
      ["address", "bytes"],
      [await hexlink.getAddress(), initData]
    );
}

export const buildAccountExecData = async (
    target: string,
    value?: BigNumberish,
    data?: string
) => {
    const artifact = await hre.artifacts.readArtifact("Account");
    const iface = new ethers.Interface(artifact.abi);
    return iface.encodeFunctionData("execute", [
      target,
      value ?? 0,
      data ?? []
    ]);
}

export const genUserOp = async (
  sender: string,
  initCode: string,
  callData: string,
  entrypoint: EntryPoint
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
    maxFeePerGas: fee.maxFeePerGas ?? 0,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 0,
    paymasterAndData: "",
    signature: "",
  };
  const op = await ethers.resolveProperties(userOp);

  const opHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
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
        ethers.keccak256(op.initCode),
        ethers.keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        ethers.keccak256(op.paymasterAndData)
      ]
    )
  );
  const chainId = await hre.getChainId();
  const userOpHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [opHash, await entrypoint.getAddress(), chainId]
    )
  );
  return [userOp, userOpHash];
}

function genValidationData() {
  const now = Math.floor(Date.now() / 1000) - 5;
  return BigInt(now + 3600) + (BigInt(now) << BigInt(48));
}

export type UserOperationStruct = {
  sender: AddressLike;
  nonce: BigNumberish;
  initCode: BytesLike;
  callData: BytesLike;
  callGasLimit: BigNumberish;
  verificationGasLimit: BigNumberish;
  preVerificationGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  paymasterAndData: BytesLike;
  signature: BytesLike;
};

export const callWithEntryPoint = async (
  sender: string,
  initCode: string,
  callData: string,
  entrypoint: EntryPoint,
  signer: any,
  log: boolean = false,
  name?: string
) => {
  const [userOp, userOpHash] = await genUserOp(sender, initCode, callData, entrypoint);
  const validation = 0;
  let message = ethers.solidityPackedKeccak256(
    ["uint8", "uint96", "bytes32"],
    [0, validation, userOpHash]
  );
  message = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32"],
    [name ?? SENDER_NAME_HASH, message]
  );
  let signature = await signer.signMessage(
    ethers.getBytes(message)
  );
  signature = ethers.solidityPacked(
    ["uint8", "uint96", "bytes"],
    [0, validation, signature]
  );
  const signed = { ...userOp, signature, };
  try {
    return await entrypoint.connect(signer).handleOps(
      [signed] as UserOperationStruct[],
      signer.address as string
    );
  } catch (e: any) {
    if (log && e.message) {
      const match = e.message.match(/0x[0-9a-z]+/);
      console.log(match);
      if (match) {
        console.log(entrypoint.interface.parseError(match[0]));
      }
    }
    throw e;
  }
}

export const call2faWithEntryPoint = async (
  sender: string,
  initCode: string,
  callData: string,
  entrypoint: EntryPoint,
  signer1: any,
  signer2: any,
  log: boolean = false
) => {
  const [userOp, userOpHash] = await genUserOp(sender, initCode, callData, entrypoint);
  const validation = genValidationData();
  let message = ethers.solidityPackedKeccak256(
    ["uint8", "uint96", "bytes32"],
    [0, validation, userOpHash]
  );
  message = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32"],
    [SENDER_NAME_HASH, message]
  );
  const signature1 = await signer1.signMessage(
    ethers.getBytes(message)
  );
  const signature2 = await signer2.signMessage(
    ethers.getBytes(message)
  );
  const signature = ethers.solidityPacked(
    ["uint8", "uint96", "bytes", "bytes"],
    [0, validation, signature1, signature2]
  );
  const signed = { ...userOp, signature, };
  try {
    return await entrypoint.handleOps([signed], signer1.address);
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
    const account = Account__factory.connect(sender, ethers.provider);
    if (await ethers.provider.getCode(sender) === "0x") {
      return 0;
    }
    return await account.getNonce() as BigNumberish;
}
