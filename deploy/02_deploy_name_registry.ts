import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {hash, loadConfig} from "../tasks/utils";

async function getValidator(hre: HardhatRuntimeEnvironment) {
    let validator = loadConfig(hre, "validator");
    if (validator == undefined) {
        return (await hre.getNamedAccounts())["validator"];
    }
    return validator;
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deployer} = await getNamedAccounts();

    // deploy contract factory
    const schema = hash("mailto");
    const domain = hre.ethers.constants.HashZero;
    const admin = await hre.deployments.get("HexlinkAdmin");
    const validator = await getValidator(hre);
    await deployments.deploy(
        "EmailNameRegistry",
        {
            from: deployer,
            contract: "NameRegistry",
            args: [schema, domain, admin.address, [validator]],
            log: true,
            autoMine: true
        }
    );
}

export default func;
func.tags = ["PROD", "TEST"];