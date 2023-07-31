import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    loadConfig
} from "../tasks/utils";
import { ethers } from "ethers";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const ens = await loadConfig(hre, "ens");
    if (ens) {
        const args = ethers.utils.defaultAbiCoder.encode(
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
func.tags = ["PROD", "TEST"];