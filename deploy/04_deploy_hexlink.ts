import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {
    hash,
    deterministicDeploy,
    getContract,
    getAdmin,
    getDeterministicAddress,
    getValidator
} from "../tasks/utils";
import { ethers } from "ethers";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    // deploy erc1967 proxy
    const deployed = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("hexlink.HexlinkERC1967Proxy"),
        []
    );
    const erc1967Proxy = await hre.ethers.getContractAt(
        "HexlinkERC1967Proxy",
        deployed.address
    );

    const {getNamedAccounts, deployments} = hre;
    const {deployer} = await getNamedAccounts();
    const authRegistry = await deployments.get("AuthRegistry");
    const simpleNs = await deployments.get("SimpleNameService");
    await deployments.deploy(
        "Hexlink",
        {
            from: deployer,
            args: [
                erc1967Proxy.address,
                simpleNs.address,
                authRegistry.address
            ],
            log: true,
        }
    );

    if (deployed.deployed) {
        const hexlinkImpl = await getContract(hre, "Hexlink");
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [admin.address]
        );
        await erc1967Proxy.initProxy(hexlinkImpl.address, data)
    }
}

export default func;
func.tags = ["PROD", "TEST"];