import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    //const admin = await deployments.get("HexlinkAdmin");
    const account = await deployments.get("Account");
    const module = await deployments.get("DefaultAuthModule");

    // deploy hexlink implementation
    await deployments.deploy(
        "Hexlink",
        {
            from: deployer,
            args: [account.address, module.address],
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
    await hre.run("deployHexlinkProxy", {});
}

export default func;
func.tags = ["PROD", "TEST"];