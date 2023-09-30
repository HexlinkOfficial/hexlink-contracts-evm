import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink } from "./utils";
import { Contract } from "ethers";

async function checkHexlink(hexlink: Contract, hre: HardhatRuntimeEnvironment) {
    const hexlinkAddr = await hexlink.getAddress();
    const factory = await hre.deployments.get("HexlinkContractFactory");
    const admin = await hre.deployments.get("HexlinkAdmin");
    const result = {
        contractFactory: factory.address,
        hexlink: hexlinkAddr,
        owner: await hexlink.owner(),
        admin: admin.address,
        hexlinkImpl: await hexlink.implementation(),
        accountProxy: hexlinkAddr,
        accountImpl: await hexlink.getAccountImplementation(),
    }
    console.log(result);
    return result;
}

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        console.log("=====================================")
        console.log("Prod: ")
        await checkHexlink(await getHexlink(hre), hre);
        console.log("=====================================")
        console.log("Dev: ")
        await checkHexlink(await getHexlink(hre, true), hre);
        console.log("=====================================")
    });

task("account", "Prints account address")
    .addParam("name")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const nameHash = hash(args.name);
        const hexlink = await getHexlink(hre);
        console.log("name hash is " + nameHash);
        const account = await hexlink.getOwnedAccount(nameHash);
        console.log("account is " + account);
        return account;
    });
