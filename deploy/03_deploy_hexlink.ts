import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
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
    console.log(factoryDeployer);
    await deployments.deploy(
        "HexlinkContractFactory", {
            from: factoryDeployer,
            args: [deployer],
            log: true,
        }
    );
    await hre.run("deployHexlinkProxy", {});
}

export default func;
func.tags = ["PROD", "TEST"];