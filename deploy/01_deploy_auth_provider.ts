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

    // deploy contract factory
    const validator = await getValidator(hre);
    console.log(validator);
    await deployments.deploy(
        "SimpleAuthProvider",
        {
            from: deployer,
            args: [validator],
            log: true,
            autoMine: true
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];