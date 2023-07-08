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
  const account = "0xba0402cdb051d09a81800e7ab29bbe7d71e3d8099f73f15a324c05bde3c8dd98";
  const rawSignature = "0xb36444232eafe9dcc1a91a3a052ac888b69c0e602c9cc72bfff63a5a405cd05e484d9f56296c185c094c8e96cdcce277cc12f63e03fb4b2ee68d378ec1dd55471b";
  const hexlink = await getHexlink(hre);
  const opInfo = {
    "userOpHash": "0x2de489466ffc05839ffe8b4d907de33f60e912d399402f77b99654db3e9f3017",
    "validationData": {
      "type": "BigNumber",
      "hex": "0x64a9b94d000064a9c0550000000000000000000000000000000000000000"
    },
    "signer": "0xf3b4e49Fd77A959B704f6a045eeA92bd55b3b571",
    "signedMessage": "0x413452cc93315565598c03ea6200a2cbfaf921b1b7580f063c58d9182b909151",
    "name": "ironchaindao@gmail.com",
    "nameType": "mailto"
  };
  const userOp = {
    "sender": "0xE3204e23Dc9e503FB0f068997aC179f8d75A14aA",
    "nonce": "0x00",
    "initCode": "0xaa08491f80c780a96cb42be84dbbfc3f6287bf38171223dda494cfc40d31c3891835fac394fbcdd0bf27978f8af488c9a97d9b406b1ad96eba0402cdb051d09a81800e7ab29bbe7d71e3d8099f73f15a324c05bde3c8dd98",
    "callData": "0x5c1c6dcd000000000000000000000000000000000000000000000000000000000000002000000000000000000000000016b170bd4c30a79d1ad3c365805be6ea911b7eba00000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
    "callGasLimit": "0xb0c5",
    "verificationGasLimit": "0x22ca62",
    "maxFeePerGas": "0x59682f16",
    "maxPriorityFeePerGas": "0x59682f00",
    "preVerificationGas": "0xb44c",
    "paymasterAndData": "0x",
    "signature": "0x0000000000000000000000000000000000000000000000000000000000000020000064a9b94d000064a9c0550000000000000000000000000000000000000000000000000000000000000000f3b4e49fd77a959b704f6a045eea92bd55b3b57100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000041b36444232eafe9dcc1a91a3a052ac888b69c0e602c9cc72bfff63a5a405cd05e484d9f56296c185c094c8e96cdcce277cc12f63e03fb4b2ee68d378ec1dd55471b00000000000000000000000000000000000000000000000000000000000000"
  }
  const [result] = ethers.utils.defaultAbiCoder.decode(
    ['tuple(uint256, address, bytes)'],
    userOp.signature,
  );
  console.log({
    validator: result[0].toHexString(),
    signer: result[1],
    signature: result[2],
  });
  const userOpHash = await genUserOpHash(userOp);
  console.log(userOpHash);
  const message = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "bytes32"],
      [result[0], userOpHash]
    )
  );
  console.log(message);
  const toSign = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32"],
      [hash(opInfo.nameType), hash(opInfo.name), message]
    )
  );
  console.log("message: " + toSign);
  const signerAddr = ethers.utils.verifyMessage(
    ethers.utils.arrayify(toSign),
    result[2]
  );
  console.log("recovered: " + signerAddr);
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
