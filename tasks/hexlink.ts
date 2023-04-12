import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { hash, getHexlink } from "./utils";

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const schema = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["mailto"])
        );
        const accountProxy = await hre.ethers.getContractAt(
            "AccountProxy",
            "0xf58182A01f4C427BaAe068C36CBE772a4976778E"
        );
        const accountBeacon = await hre.ethers.getContractAt(
            "AccountBeacon",
            await accountProxy.beacon(),
        );
        const result = {
            "contractFactory": "0xe91B4B035349eF2EB743d73D8Dd2cb4d172980De",
            "admin": "0xda960A1b2D45B92439dACD470bD15C754948Bc4D",
            "hexlinkImpl": await hexlink.implementation(),
            "hexlink": "0x41C72eF8834d2937c4Bf855F8fd28D0E33A3E5A1",
            "accountProxy": "0xf58182A01f4C427BaAe068C36CBE772a4976778E",
            "accountBeacon": accountBeacon.address,
            "accountImpl": await accountBeacon.implementation(),
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