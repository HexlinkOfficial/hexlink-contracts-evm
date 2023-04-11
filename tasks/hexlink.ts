import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, Contract } from "ethers";
import { hash } from "./utils";

export async function getHexlink(hre : HardhatRuntimeEnvironment, hexlink?: string) : Promise<Contract> {
    return await hre.ethers.getContractAt(
        "Hexlink",
        hexlink || "0x41C72eF8834d2937c4Bf855F8fd28D0E33A3E5A1"
    );
}

task("hexlink", "get hexlink contract address")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        return await getHexlink(hre);
    });

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const schema = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["mailto"])
        );
        const result = {
            "contractFactory": "0xe91B4B035349eF2EB743d73D8Dd2cb4d172980De",
            "admin": "0xda960A1b2D45B92439dACD470bD15C754948Bc4D",
            "hexlinkImpl": "0x07308f0250DDf03Debc99b5bb47a9F613f347793",
            "hexlink": "0x41C72eF8834d2937c4Bf855F8fd28D0E33A3E5A1",
            "accountProxy": "0xf58182A01f4C427BaAe068C36CBE772a4976778E",
            "accountBeacon": "0x1b9F49FEEfC4F519352DA188861123ad7b2e7cB6",
            "accountImpl": "0x7D060710bAc591BC00A1B87bDc8431BD2B5b070E",
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