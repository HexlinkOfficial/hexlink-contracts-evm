import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { deterministicDeploy, hash } from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployer} = await hre.ethers.getNamedSigners();
    const impl = await hre.deployments.deploy(
        "Airdrop", {
            from: deployer.address,
            args: [],
            log: true,
        }
    );

    // deploy erc1967 proxy
    const proxy = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        "AirdropProxy", /* alias */
        hash("airdrop"),
    );
    if (proxy.deployed) {
        const airdrop = await hre.ethers.getContractAt(
            "HexlinkERC1967Proxy",
            proxy.address,
            deployer
        );
        await airdrop.initProxy(impl.address, "0x")
    }
}

export default func;
func.tags = ["PROD", "TEST"];