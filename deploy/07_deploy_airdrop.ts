import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { deterministicDeploy, getEntryPoint, getHexlink, hash } from "../tasks/utils";

async function deployAirdropPaymaster(
    hre: HardhatRuntimeEnvironment,
    dev: boolean,
    airdrop: string,
) {
    const {deployer} = await hre.ethers.getNamedSigners();
    const entrypoint = await getEntryPoint(hre);
    const hexlink = await getHexlink(hre, dev);
    const args = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "address"],
        [
            await entrypoint.getAddress(),
            await hexlink.getAddress(),
            airdrop,
            deployer.address,
        ]
    );
    await deterministicDeploy(
        hre,
        "AirdropPaymaster",
        dev ? "AirdropPaymasterDev" : "AirdropPaymaster", /* alias */
        hash(dev ? "airdrop.paymaster.dev" : "airdrop.paymaster"),
        args
    );
}

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

    // deploy paymaster for hexlink
    await deployAirdropPaymaster(
        hre,
        false,
        proxy.address,
    );

    // deploy paymaster for hexlink dev
    await deployAirdropPaymaster(
        hre,
        true,
        proxy.address,
    );
}

export default func;
func.tags = ["PROD", "TEST"];