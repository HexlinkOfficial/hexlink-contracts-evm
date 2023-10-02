import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { deterministicDeploy, getEntryPoint, getHexlink, hash } from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployer} = await hre.ethers.getNamedSigners();
    const impl = await hre.deployments.deploy(
        "Airdrop", {
            from: deployer.address,
            args: [],
            log: true,
        }
    );

    // deploy airdrop proxy
    const proxy = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        "AirdropProxy", /* alias */
        hash("airdrop.v2"),
    );
    if (proxy.deployed) {
        const airdrop = await hre.ethers.getContractAt(
            "HexlinkERC1967Proxy",
            proxy.address,
            deployer
        );
        const airdropImpl = await hre.ethers.getContractAt(
            "Airdrop", impl.address);
        const data = airdropImpl.interface.encodeFunctionData(
            "initialize", [deployer.address]
        );
        await airdrop.initProxy(impl.address, data);
    }

    // deploy airdrop paymaster
    const entrypoint = await getEntryPoint(hre);
    const hexlink = await getHexlink(hre);
    const args = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "address"],
        [
            await entrypoint.getAddress(),
            await hexlink.getAddress(),
            proxy.address,
            deployer.address,
        ]
    );
    await deterministicDeploy(
        hre,
        "AirdropPaymaster",
        "AirdropPaymaster", /* alias */
        hash("airdrop.paymaster"),
        args
    );
}

export default func;
func.tags = ["PROD", "TEST"];