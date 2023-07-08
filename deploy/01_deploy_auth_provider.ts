import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {getValidator} from "../tasks/utils";

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
            args: [validator, ""],
            log: true,
            autoMine: true
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];