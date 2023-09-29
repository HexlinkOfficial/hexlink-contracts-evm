import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    getValidator,
    loadConfig
} from "../tasks/utils";
import { ethers } from "ethers";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {getNamedAccounts, deployments} = hre;
    const {deployer} = await getNamedAccounts();
    const dauthValdiator = await getValidator(hre, "dauthValidator");
    await deployments.deploy(
        "SimpleNameService",
        {
            from: deployer,
            args: [dauthValdiator],
            log: true,
        }
    );

    const ens = await loadConfig(hre, "ens");
    if (ens) {
        const args = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address"],
            [ens, ]
        );
        await deterministicDeploy(
            hre,
            "EnsNameService",
            hash("hexlink.EnsNameService"),
            args
        );
    }
}

export default func;
func.tags = ["BETA"];