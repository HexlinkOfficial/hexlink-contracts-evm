import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { Contract } from "ethers";
import {
    hash,
    deterministicDeploy,
    getValidator,
    getEntryPoint,
    getAdmin,
} from "../tasks/utils";

async function deploy(hre: HardhatRuntimeEnvironment, dev: boolean = false) {
    // deploy erc1967 proxy
    const deployed = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        dev ? hash("dev.hexlink") : hash("hexlink"),
    );
    const { deployer } = await hre.ethers.getNamedSigners();
    const artifact = await hre.artifacts.readArtifact("HexlinkERC1967Proxy");
    const factory = new Contract(
        deployed.address,
        artifact.abi,
        deployer
    );

    // deploy account implementation
    const entrypoint = await getEntryPoint(hre);
    const account = await hre.deployments.deploy(
        "HexlinkAccount",
        {
            from: deployer.address,
            args: [
                await entrypoint.getAddress(),
                deployed.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const dauthValdiator = await getValidator(hre, "dauthValidator");
    const impl = await hre.deployments.deploy(
        dev ? "HexlinkDev" : "Hexlink",
        {
            from: deployer.address,
            contract: "Hexlink",
            args: [
                dauthValdiator,
                account.address,
            ],
            log: true,
        }
    );

    // init hexlink
    if (deployed.deployed) {
        const hexlinkImpl = await hre.ethers.getContractAt(
            "Hexlink", impl.address);
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [await admin.getAddress()]
        );
        await factory.initProxy(impl.address, data)
    }
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    await deploy(hre);
    await deploy(hre, true /* dev */);
}

export default func;
func.tags = ["PROD", "TEST"];
