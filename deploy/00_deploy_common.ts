import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {getNamedAccounts, deployments} = hre;
    const {deployer} = await getNamedAccounts();

    await deployments.deploy(
        "HexlinkAdmin",
        {
            from: deployer,
            contract: "TimelockController",
            args: [
                0,
                [deployer],
                [deployer],
                hre.ethers.ZeroAddress
            ],
            log: true,
        }
    );

    const {factoryDeployer} = await getNamedAccounts();
    await deployments.deploy(
        "HexlinkContractFactory", {
            from: factoryDeployer,
            args: [deployer],
            log: true,
        }
    );

    if (hre.network.name === 'hardhat') {
        await hre.deployments.deploy(
            "EntryPoint", {
                from: deployer,
                args: [],
                log: true,
            }
        );
    }
}

export default func;
func.tags = ["PROD", "TEST"];