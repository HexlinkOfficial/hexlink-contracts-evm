import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    getAdmin,
    getEntryPoint,
} from "../tasks/utils";
import {
    HexlinkERC1967Proxy__factory,
} from "../typechain-types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    // deploy erc1967 proxy
    const deployed = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("hexlink")
    );
    const hexlink = HexlinkERC1967Proxy__factory.connect(
        deployed.address,
        hre.ethers.provider
    );

    const { deployer } = await hre.ethers.getNamedSigners();
    if (hre.network.name === 'hardhat') {
        await hre.deployments.deploy(
            "EntryPoint", {
                from: deployer.address,
                args: [],
                log: true,
            }
        );
    }
    const entrypoint = await getEntryPoint(hre);
    const account = await hre.deployments.deploy(
        "Account",
        {
            from: deployer.address,
            contract: "Account",
            args: [
                await entrypoint.getAddress(),
                deployed.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const authRegistry = await hre.deployments.get("AuthRegistry");
    const simpleNs = await hre.deployments.get("SimpleNameService");
    const impl = await hre.deployments.deploy(
        "Hexlink",
        {
            from: deployer.address,
            args: [
                simpleNs.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    // init hexlink
    if (deployed.deployed) {
        const hexlinkImpl = await hre.ethers.getContractAt("Hexlink", impl.address); 
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [await admin.getAddress(), account.address]
        );
        await hexlink.connect(deployer).initProxy(impl.address, data)
    }
}

export default func;
func.tags = ["PROD", "TEST"];
