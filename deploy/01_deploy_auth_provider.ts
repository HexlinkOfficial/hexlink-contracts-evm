import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {loadConfig, getDAuthRegistry} from "../tasks/utils";

async function getValidator(hre: HardhatRuntimeEnvironment) {
    let validator = loadConfig(hre, "validator");
    if (hre.network.name == "hardhat" || validator == undefined) {
        return (await hre.getNamedAccounts())["validator"];
    }
    return validator;
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    // deploy registry
    const validator = await getValidator(hre);
    if (hre.network.name === 'hardhat') {
        await hre.deployments.deploy(
            "DAuthRegistryTest", {
                from: deployer,
                args: [[validator, deployer]],
                log: true,
            }
        );
    }

    // deploy contract factory
    const dAuth = await getDAuthRegistry(hre);
    await deployments.deploy(
        "DAuthAuthProvider",
        {
            from: deployer,
            args: [deployer, validator, dAuth.address],
            log: true,
            autoMine: true
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];