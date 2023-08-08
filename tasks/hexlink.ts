import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink, getContract } from "./utils";

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
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
