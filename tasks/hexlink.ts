import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { hash, getHexlink, getDeployedContract } from "./utils";

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const factory = await getDeployedContract(hre, "ContractFactory");
        const admin = await getDeployedContract(hre, "TimelockController", "HexlinkAdmin");
        const schema = hash("mailto");
        const result = {
            "contractFactory": factory.address,
            "hexlink": hexlink.address,
            "admin": admin.address,
            "hexlinkImpl": await hexlink.implementation(),
            "accountProxy": hexlink.address,
            "accountImpl": await hexlink.accountImplementation(),
            "emailNameRegistry": await hexlink.getRegistry(
                schema,
                ethers.constants.HashZero
            ),
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