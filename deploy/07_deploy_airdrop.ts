import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { deterministicDeploy, getBytecode, getHexlink, hash, loadConfig } from "../tasks/utils";
import { getEntryPointAddress } from "../tasks/deployer";

async function deployHexlinkPaymaster(
    hre: HardhatRuntimeEnvironment,
    airdrop: string,
) {
    const {deployer} = await hre.ethers.getNamedSigners();
    const hexlink = await getHexlink(hre);
    const hexlinkDev = await getHexlink(hre, true);
    const impl = await hre.deployments.deploy(
        "HexlinkPaymaster", {
            from: deployer.address,
            args: [
                getEntryPointAddress(),
                await hexlink.getAddress(),
                await hexlinkDev.getAddress(),
            ],
            log: true,
        }
    );

    // deploy hexlink paymaster proxy
    const artifact = await hre.artifacts.readArtifact("HexlinkERC1967Proxy");
    const proxy = await deterministicDeploy(
        hre,
        "HexlinkPaymasterProxy",
        getBytecode(artifact, "0x"),
        hash("hexlink.paymaster")
    );
    if (proxy.deployed) {
        const paymaster = await hre.ethers.getContractAt(
            "HexlinkERC1967Proxy",
            proxy.address,
            deployer
        );
        const paymasterImpl = await hre.ethers.getContractAt(
            "HexlinkPaymaster", impl.address);
        const artifact2 = await hre.artifacts.readArtifact("Airdrop");
        const iface = new hre.ethers.Interface(artifact2.abi);
        const data = paymasterImpl.interface.encodeFunctionData(
            "initialize", [
                deployer.address,
                [airdrop],
                [iface.getFunction("claimV2")!.selector]
            ]
        );
        await paymaster.initProxy(impl.address, data);
    
        // check ownership
        const owner = loadConfig(hre, "safe") ?? deployer.address;
        const pmaster = await hre.ethers.getContractAt(
            "HexlinkPaymaster", proxy.address, deployer);
        if ((await pmaster.owner()) != owner) {
            await pmaster.transferOwnership(owner);
        }
    }
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

    await deployHexlinkPaymaster(hre, proxy.address);
}

export default func;
func.tags = ["PROD", "TEST", "AIRDROP"];