import * as hre from "hardhat";
import { ethers } from "ethers";
import { hash, getHexlink } from "../tasks/utils";

async function main() {
    const hexlink = await getHexlink(hre);
    const schema = hash("mailto");
    const registryAddr = await hexlink.getRegistry(
        schema,
        ethers.constants.HashZero
    );
    const registry = await hre.ethers.getContractAt(
        "NameRegistry",
        registryAddr,
    );

    const nameHash = "0x73ddf1bbbd994530ccf3b6c056be0c13be40ee3d960401be14b680d773fd0849";
    const requestId = "0x4986786ba079a987d0be666c6cdfa10a8b6e5734990e364013ee8b258b44894f";
    const proof = "0x00000000000000000000000000000000000000000000000000000000645f959a000000000000000000000000943fabe0d1ae7130fc48cf2abc85f01fc987ec81000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000416404a684c956e9dcb7160876456b908958964cdea45cffcd94a6e2b5741d3567389810d9d9771104b091b32e7f943fdb3c539dbbf68e8636e17854bb75f454381c00000000000000000000000000000000000000000000000000000000000000";
    const [expiredAt, validator, signature] = ethers.utils.defaultAbiCoder.decode(
        ["uint256", "address", "bytes"], proof
    );
    console.log("expiredAt: ", expiredAt);
    console.log("validator: ", validator);
    console.log("signature: ", signature);

    const message = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "uint256", "bytes"],
        [nameHash, requestId, expiredAt, signature],
    ));
    console.log("message: ", message);
    const recoveredAddress = ethers.utils.verifyMessage(
        ethers.utils.arrayify(message), signature);
    console.log("recovered: ", recoveredAddress);

    const result = await registry.validateName(nameHash, requestId, proof);
    console.log(result.toNumber());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });