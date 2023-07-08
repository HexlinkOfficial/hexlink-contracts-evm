import * as hre from "hardhat";
import { getEntryPoint, getHexlink } from "../tasks/utils";
import { UserOperationStruct } from '@account-abstraction/contracts'
import { hash } from '../tasks/utils'

import { ethers } from "ethers";

const genUserOpHash = async (userOp : UserOperationStruct) => {
  const op = await ethers.utils.resolveProperties(userOp);
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
  const chainId = hre.network.config.chainId
  const entryPoint = await getEntryPoint(hre);
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [opHash, entryPoint.address, chainId]
    )
  );
}

async function testSignature() {
  const account = "0xa09239c9d59b9188fefdf236829505fe6b6d041a51fe5605927a980d9eeaf678";
  const expectedUserOpHash = "0x734158798bcade39d0190bc76970eaa94ff6f0cc9b7da88475d05d8f32366f51";
  const rawSignature = "0xa1710a91a3513cde6078f07240162f2b6959a96e1dc42c354a0607d3e86e4e386ce82749005b0de7cdc4039661f6f122f2a54b3ee3a6abb425c02a9f02c6ae2e1c";
  const hexlink = await getHexlink(hre);
  const initCode = "0xaa08491f80c780a96cb42be84dbbfc3f6287bf38171223dda494cfc40d31c3891835fac394fbcdd0bf27978f8af488c9a97d9b406b1ad96ea09239c9d59b9188fefdf236829505fe6b6d041a51fe5605927a980d9eeaf678";
  const signature = "0x0000000000000000000000000000000000000000000000000000000000000020000064a99707000064a99e0f0000000000000000000000000000000000000000000000000000000000000000f3b4e49fd77a959b704f6a045eea92bd55b3b57100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000041a1710a91a3513cde6078f07240162f2b6959a96e1dc42c354a0607d3e86e4e386ce82749005b0de7cdc4039661f6f122f2a54b3ee3a6abb425c02a9f02c6ae2e1c00000000000000000000000000000000000000000000000000000000000000";
  const userOp = {
    "sender": "0x19daD6CFb526D98c22E66f3819c0d071BB2E2bFd",
    "nonce": "0x10",
    "initCode": [],
    "callData": "0x5c1c6dcd000000000000000000000000000000000000000000000000000000000000002000000000000000000000000016b170bd4c30a79d1ad3c365805be6ea911b7eba000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
    "callGasLimit": "0xa9d2",
    "verificationGasLimit": "0x1f58ed",
    "preVerificationGas": "0xae94",
    "maxFeePerGas": "0x59682f14",
    "maxPriorityFeePerGas": "0x59682f00",
    "paymasterAndData": [],
    "signature": signature
  };
  const [result] = ethers.utils.defaultAbiCoder.decode(
    ['tuple(uint256, address, bytes)'],
    signature,
  );
  console.log(result);
  const userOpHash = await genUserOpHash(userOp);
  console.log(userOpHash);
  const message = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes32"],
      [result[0], userOpHash]
    )
  );
  const toSign = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32"],
      [hash("mailto"), hash("shu@hexlink.io"), message]
    )
  );
  console.log("message: " + toSign);
  const signerAddr = ethers.utils.verifyMessage(
    ethers.utils.arrayify(toSign),
    result[2]
  );
  console.log("recovered: " + signerAddr);
  console.log("signer: " + result[1]);
  // const entryPoint = await getEntryPoint(hre);
  // const validationData = await entryPoint.handleOps(
  //   [userOp],
  //   "0xa4b368e3a9D49Ff15b58f70Fb976724A98B6D149"
  // );
  // console.log(validationData);
}

async function main() {
  await testSignature();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
