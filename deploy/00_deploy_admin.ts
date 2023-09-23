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
}

export default func;
func.tags = ["PROD", "TEST"];