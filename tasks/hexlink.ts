import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink, getHexlinkDev, getContract } from "./utils";
import { ethers } from "ethers";

async function checkHexlink(hexlink: ethers.Contract, hre: HardhatRuntimeEnvironment) {
    const factory = await getContract(hre, "HexlinkContractFactory");
    const admin = await getContract(hre, "TimelockController", "HexlinkAdmin");
    const ns = await getContract(hre, "SimpleNameService");
    const result = {
        contractFactory: factory.address,
        hexlink: hexlink.address,
        owner: await hexlink.owner(),
        admin: admin.address,
        hexlinkImpl: await hexlink.implementation(),
        accountProxy: hexlink.address,
        accountImpl: await hexlink.getAccountImplementation(),
        nameService: await hexlink.getNameService(),
        SimpleNameService: {
            address: ns.address,
            defaultOwner: await ns.defaultOwner(),
        },
        authRegistry: await hexlink.getAuthRegistry(),
    }
    console.log(result);
    return result;
}

task("hexlink_check", "check hexlink metadata")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = args.dev ? await getHexlinkDev(hre) : await getHexlink(hre);
        await checkHexlink(hexlink, hre);
    });

task("account", "Prints account address")
    .addParam("name")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const nameHash = hash(args.name);
        const hexlink = await getHexlink(hre);
        console.log("name hash is " + nameHash);
        const account = await hexlink.ownedAccount(nameHash);
        console.log("account is " + account);
        return account;
    });
