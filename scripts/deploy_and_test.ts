import * as hre from "hardhat";
import { type Contract } from "ethers";
import { getHexlink } from "../tasks/utils";
import { hash, isContract } from '../tasks/utils'

async function main() {
    const { deployer } = await hre.ethers.getNamedSigners();
    const hexlink = (
        await getHexlink(hre, true)
    ).connect(deployer) as Contract;
    const name = hash("mailto:shu@hexlink.io");
    const accountAddr = await hexlink.getOwnedAccount(name);
    console.log("Account: ", accountAddr);
    if (!await isContract(hre, accountAddr)) {
        console.log("Deploy account ...");
        await hexlink.deploy(name);
    }
    const account = await hre.ethers.getContractAt("Account", accountAddr);
    console.log("Account Implementation: ", await account.implementation());
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});
