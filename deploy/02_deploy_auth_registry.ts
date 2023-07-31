import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { hash, deterministicDeploy } from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    await deterministicDeploy(
        hre,
        "AuthRegistry",
        hash("hexlink.AuthRegistry"),
        []
    );
}

export default func;
func.tags = ["PROD", "TEST"];