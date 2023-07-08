import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {getValidator} from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    const dauthValdiator = await getValidator(hre, "dauthValidator");
    await deployments.deploy(
        "DAuthProvider",
        {
            from: deployer,
            contract: "SimpleAuthProvider",
            args: [dauthValdiator, ""],
            log: true,
            autoMine: true
        }
    );

    const hexlinkValidator = await getValidator(hre, "hexlinkValidator");
    await deployments.deploy(
        "HexlinkProvider",
        {
            from: deployer,
            contract: "SimpleAuthProvider",
            args: [hexlinkValidator, ""],
            log: true,
            autoMine: true
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];