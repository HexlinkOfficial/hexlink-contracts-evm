import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    // deploy contract factory
    const {factoryDeployer} = await getNamedAccounts();
    console.log("factoryDeployer is ", factoryDeployer);
    await deployments.deploy(
        "ContractFactory", {
            from: factoryDeployer,
            args: [deployer],
            log: true,
        }
    );
    await hre.run("deployAll", {});
}

export default func;
func.tags = ["PROD", "TEST"];