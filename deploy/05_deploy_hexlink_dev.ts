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
        hash("dev.hexlink.Hexlink"),
        []
    );
    const hexlinkDev = await hre.ethers.getContractAt(
        "HexlinkERC1967Proxy",
        deployed.address
    );

    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    const entrypoint = await getEntryPoint(hre);
    await deployments.deploy(
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
    const impl = await deployments.deploy(
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
    const hexlinkDevImpl = await hre.ethers.getContractAt("Hexlink", impl.address);

    // init hexlink
    if (deployed.deployed) {
        const data = hexlinkDevImpl.interface.encodeFunctionData(
            "initialize", [deployer, impl.address]
        );
        await hexlinkDev.initProxy(impl.address, data)
    }
}

export default func;
func.tags = ["DEV"];
