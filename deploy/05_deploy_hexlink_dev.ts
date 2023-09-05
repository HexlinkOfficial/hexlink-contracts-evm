import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    getEntryPoint,
} from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    // deploy erc1967 proxy
    const deployed = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("dev.hexlink"),
        []
    );
    const hexlinkDev = await hre.ethers.getContractAt(
        "HexlinkERC1967Proxy",
        deployed.address
    );

    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const entrypoint = await getEntryPoint(hre);
    const accountDev = await deployments.deploy(
        "AccountDev",
        {
            from: deployer,
            contract: "Account",
            args: [
                entrypoint.address,
                hexlinkDev.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const authRegistry = await deployments.get("AuthRegistry");
    const ns = await deployments.deploy(
        "SimpleNameServiceDev",
        {
            from: deployer,
            contract: "SimpleNameService",
            args: [deployer],
            log: true,
        }
    );
    const devImpl = await deployments.deploy(
        "HexlinkDev",
        {
            from: deployer,
            contract: "Hexlink",
            args: [
                ns.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    // init hexlink
    if (deployed.deployed) {
        const hexlinkDevImpl = await hre.ethers.getContractAt("Hexlink", devImpl.address);
        const data = hexlinkDevImpl.interface.encodeFunctionData(
            "initialize", [deployer, accountDev.address]
        );
        await hexlinkDev.initProxy(devImpl.address, data)
    }
}

export default func;
func.tags = ["DEV"];
