import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { getAdmin } from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    const {factoryDeployer} = await getNamedAccounts();
    await deployments.deploy(
        "HexlinkContractFactory", {
            from: factoryDeployer,
            args: [deployer],
            log: true,
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];