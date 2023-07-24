import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { hash, getEntryPoint, getHexlink, getContract, deterministicDeploy, loadConfig } from "../tasks/utils";

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

    const authRegistry = await deterministicDeploy(
        hre,
        "AuthRegistry",
        hash("hexlink.AuthRegistry"),
        []
    );
    const entrypoint = await getEntryPoint(hre);
    const hexlink = await getHexlink(hre);
    const nameService = await getContract(hre, 'DAuthNameService');
    await deployments.deploy(
        "AccountForDAuth",
        {
            from: deployer,
            contract: "Account",
            args: [
                entrypoint.address,
                hexlink.address,
                nameService.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    const ens = await loadConfig(hre, "ens");
    if (ens) {
        await deployments.deploy(
            "AccountForEns",
            {
                from: deployer,
                contract: "Account",
                args: [
                    entrypoint.address,
                    hexlink.address,
                    ens,
                    authRegistry.address
                ],
                log: true,
            }
        );
    }
}

export default func;
func.tags = ["PROD", "TEST"];