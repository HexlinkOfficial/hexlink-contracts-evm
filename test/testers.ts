import * as hre from "hardhat";
import { hash } from "../tasks/utils";
import { ethers } from "hardhat";
import { Contract, BigNumberish } from "ethers";
import { UserOperationStruct } from '@account-abstraction/contracts'
import { resolveProperties } from 'ethers/lib/utils'

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

export const callWithEntryPoint = async (
    sender: string,
    initCode: string | [],
    callData: string | [],
    entrypoint: Contract
) => {
    const {deployer, validator} = await hre.ethers.getNamedSigners();
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
    const signature = await validator.signMessage(
      ethers.utils.arrayify(userOpHash)
    );
    const authInput = ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes"],
      [validator.address, signature]
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

async function buildAuthInput(factor: any, signer: string, signature: string) {
  const encoded = ethers.utils.defaultAbiCoder.encode(
    ['tuple(tuple(bytes32, bytes32, tuple(address, uint8)), address, bytes)'],
    [
      [
        [
          factor.nameType,
          factor.name,
          [factor.provider.provider, factor.provider.providerType],
        ],
        signer,
        signature
      ]
    ]
  );
  return encoded;
}
