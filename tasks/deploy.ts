import { task } from "hardhat/config";
import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { hash, getFactory, getDeployedContract } from "./utils";

function getBytecode(artifact: Artifact, args: string | []) {
    return ethers.utils.solidityPack(
        ["bytes", "bytes"],
        [artifact.bytecode, args]
    );
}

async function isContract(hre: HardhatRuntimeEnvironment, address: string) {
    try {
        const code = await hre.ethers.provider.getCode(address);
        if (code !== '0x') return true;
    } catch (error) { }
    return false;
}

task("deployHexlinkProxy", "deploy hexlink related contracts")
    .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
        const { ethers } = hre;
        const { deployer } = await hre.ethers.getNamedSigners();
        const factory = await getFactory(hre);

        // deploy erc1967 proxy with dummy implementation as default implementation
        const bytecode = getBytecode(
            await hre.artifacts.readArtifact("HexlinkERC1967Proxy"), []
        );
        const salt = hash("hexlink.HexlinkERC1967Proxy");
        const erc1967Proxy = await factory.getAddress(bytecode, salt);
        if (await isContract(hre, erc1967Proxy)) {
            console.log(`Reusing "HexlinkERC1967Proxy" deployed at ${erc1967Proxy}`);
        } else {
            const tx = await factory.connect(
                deployer
            ).deploy(bytecode, salt);
            await tx.wait();
            console.log(`deploying "HexlinkERC1967Proxy" (tx: ${tx.hash})...: deployed at ${erc1967Proxy}`);
        }

        // deploy and init hexlink proxy
        let hexlink = await hre.ethers.getContractAt("IHexlinkERC1967Proxy", erc1967Proxy);
        if (await hexlink.implementation() === ethers.constants.AddressZero) {
            const admin = await hre.deployments.get("HexlinkAdmin");
            const hexlinkImpl = await getDeployedContract(hre, "Hexlink");
            const data = hexlinkImpl.interface.encodeFunctionData(
                "initialize", [admin.address]
            );
            await hexlink.initProxy(hexlinkImpl.address, data);
            console.log(
                `HexlinkProxy initiated with ` +
                `implementation=${hexlinkImpl.address}, ` +
                `owner=${admin.address}, `
            );
        }

        return hexlink.address;
    });