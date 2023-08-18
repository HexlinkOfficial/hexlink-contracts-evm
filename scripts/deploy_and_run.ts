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
    const name = hash("mailto:shu@hexlink.io");
    const accountAddr = await hexlink.getOwnedAccount(name);
    console.log("Account: ", accountAddr);
    console.log("Account Impl: ", await hexlink.getAccountImplementation());
    if (!await isContract(hre, accountAddr)) {
        console.log("Deploy account ...");
        const tx = await hexlink.connect(deployer).deploy(name);
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
        ethers.utils.parseEther("0.1"),
        "0x"
    );
    console.log(`sending 0.1 ETH from ${accountAddr} to ${target}`);
    // const tx = await callWithEntryPoint(accountAddr, "0x", callData, ep, deployer, true);
    // console.log("processing with tx hash: ", tx.hash);
    // await tx.wait();
    console.log(ep.interface.parseError(
        "0x220266b600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000001441413234207369676e6174757265206572726f72000000000000000000000000"
    ));
    
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});
