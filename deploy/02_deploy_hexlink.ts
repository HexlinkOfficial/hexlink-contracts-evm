import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { hash, deterministicDeploy, getContract, getAdmin } from "../tasks/utils";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {getNamedAccounts, deployments} = hre;
    const {deployer} = await getNamedAccounts();
    await deployments.deploy(
        "Hexlink",
        {
            from: deployer,
            args: [],
            log: true,
        }
    );

    // deploy erc1967 proxy
    const result = await deterministicDeploy(
        hre,
        "HexlinkERC1967Proxy",
        hash("hexlink.HexlinkERC1967Proxy"),
        []
    );
    if (result.deployed) {
        let proxy = await hre.ethers.getContractAt("HexlinkERC1967Proxy", result.address);
        const hexlinkImpl = await getContract(hre, "Hexlink");
        const admin = await getAdmin(hre);
        const data = hexlinkImpl.interface.encodeFunctionData(
            "initialize", [admin.address]
        );
        await proxy.initProxy(hexlinkImpl.address, data)
    }
}

export default func;
func.tags = ["PROD", "TEST"];