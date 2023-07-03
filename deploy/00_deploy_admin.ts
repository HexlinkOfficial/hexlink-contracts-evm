import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    // deploy contract factory
    const admin = await deployments.getOrNull("HexlinkAdmin");
    if (admin == null) {
        await deployments.deploy(
            "HexlinkAdmin",
            {
                from: deployer,
                contract: "TimelockController",
                args: [
                    0,
                    [deployer], // proposer
                    [deployer], // executor
                    hre.ethers.constants.AddressZero
                ],
                log: true,
                autoMine: true
            }
        );
    }
}

export default func;
func.tags = ["PROD", "TEST"];