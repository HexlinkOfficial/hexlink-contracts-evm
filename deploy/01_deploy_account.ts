import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    let entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    if (hre.network.name === 'hardhat') {
        const deployed = await deployments.deploy(
            "EntryPoint", {
                from: deployer,
                args: [],
                log: true,
            }
        );
        entrypoint = deployed.address;
    }

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