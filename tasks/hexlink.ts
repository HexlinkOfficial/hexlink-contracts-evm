import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink, getContract } from "./utils";

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const proxy = await hre.ethers.getContractAt("IHexlinkERC1967Proxy", hexlink.address);
        const factory = await getContract(hre, "HexlinkContractFactory");
        const admin = await getContract(hre, "TimelockController", "HexlinkAdmin");
        const result = {
            contractFactory: factory.address,
            hexlink: hexlink.address,
            admin: admin.address,
            hexlinkImpl: await proxy.implementation(),
            accountProxy: hexlink.address,
            accountImpl: await hexlink.getAccountImplementation(),
            authProvider: {
                email: await hexlink.getAuthProvider(hash("mailto")),
                tel: await hexlink.getAuthProvider(hash("tel")),
            },
            validator: {
                email: await hexlink.getDefaultValidator(hash("mailto")),
                tel: await hexlink.getDefaultValidator(hash("tel")),
            }
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
