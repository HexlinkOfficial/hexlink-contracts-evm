import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { Contract } from "ethers";
import {
    hash,
    deterministicDeploy,
    getEntryPoint,
    getBytecode,
} from "../tasks/utils";

async function deploy(hre: HardhatRuntimeEnvironment, dev: boolean = false) {
    // deploy erc1967 proxy
    const { deployer } = await hre.ethers.getNamedSigners();
    const artifact = await hre.artifacts.readArtifact("HexlinkERC1967Proxy");
    const proxy = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        getBytecode(artifact, "0x"),
        dev ? hash("hexlink.dev") : hash("hexlink.prod"),
    );
    const factory = new Contract(
        proxy.address,
        artifact.abi,
        deployer
    );

    // deploy account implementation
    const entrypoint = await getEntryPoint(hre);
    const accountDev = await hre.deployments.deploy(
        dev ? "ERC4972AccountDev" : "ERC4972Account",
        {
            from: deployer.address,
            contract: "ERC4972Account",
            args: [
                await entrypoint.getAddress(),
                proxy.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const authRegistry = await hre.deployments.get("AuthRegistry");
    const simpleNs = await hre.deployments.get("SimpleNameService");
    const devImpl = await hre.deployments.deploy(
        dev ? "ERC4972AccountFactoryDev" : "ERC4972AccountFactory",
        {
            from: deployer.address,
            contract: "ERC4972AccountFactory",
            args: [
                simpleNs.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    // init hexlink
    if (proxy.deployed) {
        const factoryImpl = await hre.ethers.getContractAt(
            "ERC4972AccountFactory", devImpl.address);
        const data = factoryImpl.interface.encodeFunctionData(
            "initialize", [deployer.address, accountDev.address]
        );
        await factory.initProxy(devImpl.address, data)
    }
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    await deploy(hre);
    await deploy(hre, true /* dev */);
}

export default func;
func.tags = ["BETA"];
