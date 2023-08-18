import * as hre from "hardhat";
import { getEntryPoint, getHexlink } from "../tasks/utils";
import { UserOperationStruct } from '@account-abstraction/contracts'
import { hash } from '../tasks/utils'

import { ethers } from "ethers";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const genUserOpHash = async (userOp : UserOperationStruct) => {
  const op = await ethers.resolveProperties(userOp);
  const opHash = ethers.keccak256(
    abiCoder.encode(
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
  const chainId = hre.network.config.chainId
  const entryPoint = await getEntryPoint(hre);
  return ethers.keccak256(
    abiCoder.encode(
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
    "userOpHash": "0xdbe7c9b5a81701dd1f08d20cb48a869350098b383adc8dab1956e91909a33ad9",
    "validationData": {
      "type": "BigNumber",
      "hex": "0x64aa292f000064aa30370000000000000000000000000000000000000000"
    },
    "signer": "0xf3b4e49Fd77A959B704f6a045eeA92bd55b3b571",
    "signedMessage": "0xdd1214ccc6d7283485ccfc414e4c3213bf8b6c66456bf00ae1f836868fa52d40",
    "name": "shu@hexlink.io",
    "nameType": "mailto"
  };
  const userOp = {
    "sender": "0x19daD6CFb526D98c22E66f3819c0d071BB2E2bFd",
    "nonce": "0x10",
    "initCode": "0x",
    "callData": "0x5c1c6dcd000000000000000000000000000000000000000000000000000000000000002000000000000000000000000016b170bd4c30a79d1ad3c365805be6ea911b7eba000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
    "callGasLimit": "0xa9d2",
    "verificationGasLimit": "0x23780",
    "maxFeePerGas": "0x59682f5e",
    "maxPriorityFeePerGas": "0x59682f00",
    "preVerificationGas": "0xae94",
    "paymasterAndData": "0x",
    "signature": "0x0000000000000000000000000000000000000000000000000000000000000020000064aa292f000064aa30370000000000000000000000000000000000000000000000000000000000000000943fabe0d1ae7130fc48cf2abc85f01fc987ec810000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000004131f5ed06bd4a00fc758ba36a5ea4b054f599796a694ee414b771f895b498014633f0b08356e58f4b97390e126048ac9d228cce02052f54b02ff206bb215037c61c00000000000000000000000000000000000000000000000000000000000000"
  };
  const [result] = abiCoder.decode(
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
  const message = ethers.keccak256(
    abiCoder.encode(
      ["uint256", "bytes32"],
      [result[0], userOpHash]
    )
  );
  console.log(message);
  const encoded = abiCoder.encode(
    ["bytes32", "bytes32", "bytes32"],
    [hash(opInfo.nameType), hash(opInfo.name), message]
  );
  const toSign = ethers.keccak256(encoded);
  console.log("name type: " + hash(opInfo.nameType));
  console.log("name: " + hash(opInfo.name));
  console.log("request id: " + message);
  console.log("encoded: " + encoded);
  console.log("signed message: " + toSign);
  const signerAddr = ethers.verifyMessage(
    ethers.getBytes(toSign),
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
