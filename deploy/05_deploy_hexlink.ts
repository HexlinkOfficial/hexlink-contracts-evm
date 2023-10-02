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
        dev ? "HexlinkDevProxy" : "HexlinkProxy",
        dev ? hash("hexlink.dev") : hash("hexlink.prod"),
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
        dev ? "HexlinkAccountDev" : "HexlinkAccount",
        {
            from: deployer.address,
            contract: "HexlinkAccount",
            args: [
                await entrypoint.getAddress(),
                deployed.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const validator = await getValidator(hre, dev ? "hexlinkDevValidator" : "hexlinkValidator");
    const impl = await hre.deployments.deploy(
        dev ? "HexlinkDev" : "Hexlink",
        {
            from: deployer.address,
            contract: "Hexlink",
            args: [
                validator,
                account.address,
            ],
            log: true,
        }
    );

    // init hexlink proxy
    const hexlinkImpl = await hre.ethers.getContractAt(
        "Hexlink", impl.address);
    try {
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [await admin.getAddress()]
        );
        await factory.initProxy(impl.address, data);
    } catch (e) {
        const hexlink = await hre.ethers.getContractAt(
          "Hexlink", deployed.address);
        try {
            await hexlink.implementation();
            console.log("Hexlink Proxy alreay initialized");
        } catch {
            console.log("Hexlink Proxy initializing error ");
            throw e;
        }
    }
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    await deploy(hre);
    await deploy(hre, true /* dev */);
}

export default func;
func.tags = ["PROD", "TEST"];
