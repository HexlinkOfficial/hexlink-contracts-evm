import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { hash, getFactory, getDeployedContract, getBytecode } from "../tasks/utils";

async function isContract(hre: HardhatRuntimeEnvironment, address: string) {
    try {
        const code = await hre.ethers.provider.getCode(address);
        if (code !== '0x') return true;
    } catch (error) { }
    return false;
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts, ethers} = hre;
    const {deployer} = await getNamedAccounts();

    // deploy hexlink implementation
    await deployments.deploy(
        "Hexlink",
        {
            from: deployer,
            args: [],
            log: true,
            autoMine: true
        }
    );

    // deploy contract factory
    const {factoryDeployer} = await getNamedAccounts();
    await deployments.deploy(
        "HexlinkContractFactory", {
            from: factoryDeployer,
            args: [deployer],
            log: true,
        }
    );

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
        const tx = await factory.deploy(bytecode, salt);
        await tx.wait();
        console.log(`deploying "HexlinkERC1967Proxy" (tx: ${tx.hash})...: deployed at ${erc1967Proxy}`);
    }

    // deploy and init hexlink proxy
    let hexlinkProxy = await hre.ethers.getContractAt("IHexlinkERC1967Proxy", erc1967Proxy);
    if (await hexlinkProxy.implementation() === ethers.constants.AddressZero) {
        const admin = await hre.deployments.get("HexlinkAdmin");
        const hexlinkImpl = await getDeployedContract(hre, "Hexlink");
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [admin.address]
        );
        await hexlinkProxy.initProxy(hexlinkImpl.address, data);
        console.log(
            `HexlinkProxy initiated with ` +
            `implementation=${hexlinkImpl.address}, ` +
            `owner=${admin.address}, `
        );
    }
}
    

export default func;
func.tags = ["PROD", "TEST"];