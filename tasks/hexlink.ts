import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { hash, getHexlink, getHexlinkDev } from "./utils";
import { Hexlink, SimpleNameService__factory } from "../typechain-types";

async function checkHexlink(hexlink: Hexlink, hre: HardhatRuntimeEnvironment) {
    const hexlinkAddr = await hexlink.getAddress();
    const factory = await hre.deployments.get("HexlinkContractFactory");
    const admin = await hre.deployments.get("HexlinkAdmin");
    const ns = await hre.deployments.get("SimpleNameService");
    const nsContract = SimpleNameService__factory.connect(
        ns.address, hre.ethers.provider);
    const result = {
        contractFactory: factory.address,
        hexlink: hexlinkAddr,
        owner: await hexlink.owner(),
        admin: admin.address,
        hexlinkImpl: await hexlink.implementation(),
        accountProxy: hexlinkAddr,
        accountImpl: await hexlink.getAccountImplementation(),
        nameService: await hexlink.getNameService(),
        SimpleNameService: {
            address: ns.address,
            defaultOwner: await nsContract.defaultOwner(),
        },
        authRegistry: await hexlink.getAuthRegistry(),
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
        await checkHexlink(await getHexlinkDev(hre), hre);
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
