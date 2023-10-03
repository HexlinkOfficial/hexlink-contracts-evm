import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink, getAdmin } from "./utils";
import { Contract } from "ethers";

async function checkHexlink(hexlink: Contract, hre: HardhatRuntimeEnvironment) {
    const hexlinkAddr = await hexlink.getAddress();
    const admin = await getAdmin(hre);
    const result = {
        hexlink: hexlinkAddr,
        owner: await hexlink.owner(),
        admin: await admin.getAddress(),
        validator: await hexlink.getValidator(),
        hexlinkImpl: await hexlink.implementation(),
        accountImpl: await hexlink.getAccountImplementation(),
    }
    console.log(result);
    return result;
}

task("check_hexlink", "check hexlink metadata")
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
