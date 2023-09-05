import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    getContract,
    getAdmin,
    getEntryPoint,
} from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    // deploy erc1967 proxy
    const deployed = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("hexlink"),
        []
    );
    const hexlink = await hre.ethers.getContractAt(
        "HexlinkERC1967Proxy",
        deployed.address
    );

    const { deployments, getNamedAccounts } = hre;
    const { deployer } = await getNamedAccounts();
    if (hre.network.name === 'hardhat') {
        await hre.deployments.deploy(
            "EntryPoint", {
                from: deployer,
                args: [],
                log: true,
            }
        );
    }
    const entrypoint = await getEntryPoint(hre);
    const account = await deployments.deploy(
        "Account",
        {
            from: deployer,
            contract: "Account",
            args: [
                entrypoint.address,
                hexlink.address,
            ],
            log: true,
        }
    );

    // deploy hexlink impl
    const authRegistry = await deployments.get("AuthRegistry");
    const simpleNs = await deployments.get("SimpleNameService");
    await deployments.deploy(
        "Hexlink",
        {
            from: deployer,
            args: [
                simpleNs.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    // init hexlink
    if (deployed.deployed) {
        const hexlinkImpl = await getContract(hre, "Hexlink");
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [admin.address, account.address]
        );
        await hexlink.initProxy(hexlinkImpl.address, data)
    }
}

export default func;
func.tags = ["PROD", "TEST"];