import * as hre from "hardhat";
import { ethers } from "hardhat";
import { getEntryPoint, getHexlinkDev } from "../tasks/utils";
import { hash, isContract } from '../tasks/utils'
import { buildAccountExecData, callWithEntryPoint } from '../test/testers';

const SENDER_NAME = hash("mailto:shu@hexlink.io");
const RECEIVER_NAME = hash("mailto:dongs2011@gmail.com");

async function main() {
    const { deployer } = await hre.ethers.getNamedSigners();
    const hexlink = await getHexlinkDev(hre);
    const accountAddr = await hexlink.getOwnedAccount(SENDER_NAME);
    console.log("Account: ", accountAddr);
    console.log("Account Impl: ", await hexlink.getAccountImplementation());
    if (!await isContract(hre, accountAddr)) {
        console.log("Deploy account ...");
        const tx = await hexlink.connect(deployer).deploy(SENDER_NAME);
        await tx.wait();
    }
    const account = await hre.ethers.getContractAt("Account", accountAddr);
    console.log("Account Implementation: ", await account.implementation());
    const balance = await ethers.provider.getBalance(accountAddr);
    console.log("Account Balance: ", ethers.utils.formatEther(balance));

    console.log("Account Owner: ", await account.getNameOwner());
    console.log("Signer: ", await deployer.address);

    const ep = await getEntryPoint(hre);
    const target = await hexlink.getOwnedAccount(RECEIVER_NAME);
    const callData = await buildAccountExecData(
        target,
        ethers.utils.parseEther("0.01"),
        "0x"
    );
    console.log(`sending 0.1 ETH from ${accountAddr} to ${target}`);
    const tx = await callWithEntryPoint(accountAddr, "0x", callData, ep, deployer, true, SENDER_NAME);
    console.log("processing with tx hash: ", tx.hash);
    await tx.wait();    
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});
