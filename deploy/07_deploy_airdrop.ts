import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { deterministicDeploy, getBytecode, getHexlink, hash, loadConfig } from "../tasks/utils";
import { getEntryPointAddress } from "../tasks/deployer";

async function deployAirdropPaymaster(
    hre: HardhatRuntimeEnvironment,
    dev: boolean,
    airdrop: string,
) {
    const {deployer} = await hre.ethers.getNamedSigners();
    const hexlink = await getHexlink(hre, dev);
    const owner = loadConfig(hre, "safe") ?? deployer.address;
    const args = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "address"],
        [
            getEntryPointAddress(),
            await hexlink.getAddress(),
            airdrop,
            owner,
        ]
    );
    const artifact = await hre.artifacts.readArtifact("AirdropPaymaster");
    await deterministicDeploy(
        hre,
        dev ? "AirdropPaymasterDev" : "AirdropPaymaster",
        getBytecode(artifact, args),
        hash(dev ? "airdrop.paymaster.dev" : "airdrop.paymaster"),
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
    const artifact = await hre.artifacts.readArtifact("HexlinkERC1967Proxy");
    const proxy = await deterministicDeploy(
        hre,
        "AirdropProxy",
        getBytecode(artifact, "0x"),
        hash("airdrop")
    );
    if (proxy.deployed) {
        const airdrop = await hre.ethers.getContractAt(
            "HexlinkERC1967Proxy",
            proxy.address,
            deployer
        );
        const airdropImpl = await hre.ethers.getContractAt(
            "Airdrop", impl.address);
        const timelock = loadConfig(hre, "timelock");
        const data = airdropImpl.interface.encodeFunctionData(
            "initialize", [timelock]
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
func.tags = ["PROD", "TEST", "AIRDROP"];