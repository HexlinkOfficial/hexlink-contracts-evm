import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments} = hre;
    const {deployer} = await hre.ethers.getNamedSigners();

    const impl = await hre.deployments.deploy(
        "Airdrop", {
            from: deployer.address,
            args: [],
            log: true,
        }
    );

    const proxy = await deployments.deploy(
        "AirdropProxy",
        {
            from: deployer.address,
            contract: "HexlinkERC1967Proxy",
            args: [],
            log: true,
        }
    );

    if (proxy.newlyDeployed) {
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