import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    getEntryPoint,
    getHexlink,
} from "../tasks/utils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();

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
    const hexlink = await getHexlink(hre);
    await deployments.deploy(
        "Account",
        {
            from: deployer,
            contract: "Account",
            args: [
                entrypoint.address,
                hexlink.address,
            ],
            log: true,
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];