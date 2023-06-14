import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { getEntryPoint } from "../tasks/deploy";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    if (hre.network.name === 'hardhat') {
        await hre.deployments.deploy(
            "EntryPoint", {
                from: deployer,
                args: [],
                log: true,
            }
        );
    }

    const entrypoint = await getEntryPoint(hre);
    await deployments.deploy(
        "Account",
        {
            from: deployer,
            args: [entrypoint],
            log: true,
            autoMine: true
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];