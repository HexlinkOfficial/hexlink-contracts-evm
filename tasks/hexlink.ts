import { task } from "hardhat/config";
import { type Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink, getContractAt } from "./utils";

async function checkHexlink(hre : HardhatRuntimeEnvironment, hexlink: Contract) {
    const factory = await getContractAt(hre, "HexlinkContractFactory");
    const admin = await getContractAt(hre, "TimelockController", "HexlinkAdmin");
    const ns = await getContractAt(hre, "SimpleNameService");
    const result = {
        contractFactory: factory.address,
        hexlink: await hexlink.getAddress(),
        owner: await hexlink.owner(),
        admin: admin.address,
        hexlinkImpl: await hexlink.implementation(),
        accountProxy: await hexlink.getAddress(),
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
        const hexlink = await getHexlink(hre, args.dev);
        await checkHexlink(hre, hexlink);
    });

task("account", "Prints account address")
    .addParam("name")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre, args.dev);
        const nameHash = hash(args.name);
        console.log("name hash is " + nameHash);
        const account = await hexlink.getOwnedAccount(nameHash);
        console.log("account is " + account);
        return account;
    });
