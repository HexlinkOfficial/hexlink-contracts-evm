import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {getValidator, loadConfig} from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {getNamedAccounts, deployments} = hre;
    const {deployer} = await getNamedAccounts();
    const dauthValdiator = await getValidator(hre, "dauthValidator");
    await deployments.deploy(
        "DAuthNameService",
        {
            from: deployer,
            args: [[dauthValdiator]],
            log: true,
        }
    );

    const ens = await loadConfig(hre, "ens");
    if (ens) {
        await deployments.deploy(
            "EnsNameService",
            {
                from: deployer,
                args: [ens],
                log: true,
            }
        );
    }
}

export default func;
func.tags = ["PROD", "TEST"];