import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    getEntryPoint,
} from "../tasks/utils";
import {
    HexlinkERC1967Proxy__factory,
} from "../typechain-types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    // deploy erc1967 proxy
    const deployed = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("dev.hexlink"),
    );
    const hexlinkDev = HexlinkERC1967Proxy__factory.connect(
        deployed.address,
        hre.ethers.provider
    );

    const { deployer } = await hre.ethers.getNamedSigners();
    const entrypoint = await getEntryPoint(hre);
    const accountDev = await hre.deployments.deploy(
        "AccountDev",
        {
            from: deployer.address,
            contract: "Account",
            args: [
                await entrypoint.getAddress(),
                deployed.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const authRegistry = await hre.deployments.get("AuthRegistry");
    const simpleNs = await hre.deployments.get("SimpleNameService");
    const devImpl = await hre.deployments.deploy(
        "HexlinkDev",
        {
            from: deployer.address,
            contract: "Hexlink",
            args: [
                simpleNs.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    // init hexlink
    if (deployed.deployed) {
        const hexlinkDevImpl = await hre.ethers.getContractAt(
            "Hexlink", devImpl.address);
        const data = hexlinkDevImpl.interface.encodeFunctionData(
            "initialize", [deployer.address, accountDev.address]
        );
        await hexlinkDev.connect(deployer).initProxy(devImpl.address, data)
    }
}

export default func;
func.tags = ["DEV"];
