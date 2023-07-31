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
    const erc1967Proxy = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("hexlink.HexlinkERC1967Proxy"),
        []
    );

    const {getNamedAccounts, deployments} = hre;
    const {deployer} = await getNamedAccounts();
    await deployments.deploy(
        "Hexlink",
        {
            from: deployer,
            args: [erc1967Proxy.address],
            log: true,
        }
    );

    if (erc1967Proxy.deployed) {
        const dauthValdiator = await getValidator(hre, "dauthValidator");
        const authRegistry = await getDeterministicAddress(
            hre,
            "AuthRegistry",
            hash("hexlink.AuthRegistry"),
            []
        );
        let proxy = await hre.ethers.getContractAt(
            "HexlinkERC1967Proxy",
            erc1967Proxy.address
        );
        const hexlinkImpl = await getContract(hre, "Hexlink");
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [
                admin.address,
                dauthValdiator,
                ethers.constants.AddressZero,
                authRegistry
            ]
        );
        await proxy.initProxy(hexlinkImpl.address, data)
    }
}

export default func;
func.tags = ["PROD", "TEST"];