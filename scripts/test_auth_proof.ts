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
  const encoded = ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32", "bytes32"],
    [hash(opInfo.nameType), hash(opInfo.name), message]
  );
  const toSign = ethers.utils.keccak256(encoded);
  console.log("name type: " + hash(opInfo.nameType));
  console.log("name: " + hash(opInfo.name));
  console.log("request id: " + message);
  console.log("encoded: " + encoded);
  console.log("signed message: " + toSign);
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
  const userOp = {
    "sender": "0xB2d7668F89085fe7CFeE4c67d9a97c8C3344Ef1b",
    "nonce": "0x10",
    "initCode": "0x",
    "callData": "0xb61d27f6000000000000000000000000b2d7668f89085fe7cfee4c67d9a97c8c3344ef1b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000024e76b05f9000000000000000000000000943fabe0d1ae7130fc48cf2abc85f01fc987ec8100000000000000000000000000000000000000000000000000000000",
    "callGasLimit": "0x2328",
    "verificationGasLimit": "0x10dd3",
    "maxFeePerGas": "0xb3c63cc0",
    "maxPriorityFeePerGas": "0x59682f00",
    "preVerificationGas": "0xad44",
    "paymasterAndData": "0x",
    "signature": "0x00000000000000000000000000ba067c3a724ddba64586d25944bdae1adcb883086dc4d7dbdc2df0db676e51cd2c57ee552128d85673f15bbd01f2a42e90765beb562e529a7744bb33e05149aa1b"
  };

  const userOpHash = await genUserOpHash(userOp);
  const signedMessage = ethers.utils.solidityKeccak256(
    ["uint8", "uint96", "bytes32"],
    [0, 0, userOpHash]
  );
  const signer = "0xf3b4e49Fd77A959B704f6a045eeA92bd55b3b571";
  const bytes = ethers.utils.arrayify(userOp.signature);
  const sig = bytes.slice(13);
  console.log(ethers.utils.hexlify(sig));
  const nameHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("mailto:peterchen.eth@gmail.com")
  );
  const encoded = ethers.utils.solidityKeccak256(
    ["bytes32", "bytes32"],
    [nameHash, signedMessage]
  );
  console.log(encoded);
  const verified = ethers.utils.verifyMessage(
    ethers.utils.arrayify(encoded),
    sig
  );
  console.log(verified);
  console.log(verified === signer);

  const acc = await hre.ethers.getContractAt("Account", "0xB2d7668F89085fe7CFeE4c67d9a97c8C3344Ef1b");
  console.log("AccountImpl: ", await acc.implementation());
  console.log("AccountVersion: ", (await acc.version()).toNumber());
  console.log("Name: ", await acc.getName());
  console.log("NameOwner: ", await acc.getNameOwner());
  const {dest, value, func} = acc.interface.decodeFunctionData("execute", userOp.callData);
  console.log(dest);
  console.log(ethers.utils.formatEther(value));
  console.log(func);

  // const entryPoint = await getEntryPoint(hre);
  // const {deployer} = await hre.ethers.getNamedSigners();
  // console.log(deployer.address);
  // const tx = await entryPoint.connect(deployer).handleOps(
  //   [userOp],
  //   deployer.address
  // );
  // console.log(tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
