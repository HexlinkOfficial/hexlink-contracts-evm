import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, BigNumber, Contract } from "ethers";
import { hash, getHexlink, getAdmin, getContract } from "./utils";
import {getValidator} from "../tasks/utils";

const processArgs = async function(
    timelock: Contract,
    args : {
        target: string,
        data: string,
        predecessor?: string,
        salt?: string,
        value?: string,
        delay?: string
    }
) {
    return [
        args.target,
        BigNumber.from(args.value || 0),
        args.data,
        args.predecessor || ethers.constants.HashZero,
        args.salt || ethers.constants.HashZero,  // salt
        BigNumber.from(args.delay || await timelock.getMinDelay())
    ];
}

task("admin_check", "check if has role")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        const minDelay = await admin.getMinDelay();
        console.log("admin is " + admin.address + ", with min delay as " + minDelay);

        const {deployer} = await hre.getNamedAccounts();
        const controller = deployer;
        console.log("Owner of admin is " + controller);

        const isProposer = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROPOSER_ROLE")),
            controller
        );
        console.log(controller + " is " + (isProposer ? "" : "not ") +  "proposer");

        const isCanceller = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CANCELLER_ROLE")),
            controller
        );
        console.log(controller + " is " + (isCanceller ? "" : "not ") +  "canceller");

        const isExecutor = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE")),
            controller
        );
        console.log(controller + " is " + (isExecutor ? "" : "not ") +  "executor");

        const isAdmin = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TIMELOCK_ADMIN_ROLE")),
            admin.address
        );
        console.log(admin.address + " is " + (isAdmin ? "" : "not ") +  "admin");
    });

task("admin_schedule", "schedule a tx")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        const { deployer } = await hre.ethers.getNamedSigners();
        const processed = await processArgs(admin, args);
        await admin.connect(deployer).schedule(...processed);
    });

task("admin_exec", "execute a tx")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        const { deployer } = await hre.ethers.getNamedSigners();
        const processed = await processArgs(admin, args);
        processed.pop();
        await admin.connect(deployer).execute(...processed);
    });

task("admin_schedule_and_exec", "schedule and execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        console.log("scheduling...");
        await hre.run("admin_schedule", args);
        const delay = Number(args.dealy) || (await admin.getMinDelay()).toNumber();
        if (delay > 0) {
            const wait = (ms: number) => {
                return new Promise( resolve => setTimeout(resolve, ms * 1000 + 2000) );
            };
            console.log("Will wait for " + delay + " seconds before exec");
            await wait(delay + 1);
        }
        console.log("executing...");
        await hre.run("admin_exec", args);
        console.log("done.");
    });

task("admin_schedule_or_exec", "schedule or execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        const processed = await processArgs(admin, args);
        processed.pop();
        const operationId = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "bytes", "bytes32", "bytes32"],
                processed
            )
        );
        if (await admin.isOperationReady(operationId)) {
            console.log("Operation is ready, will execute.");
            await hre.run("admin_exec", args);
        } else if (await admin.isOperationPending(operationId)) {
            console.log("Operation is pending, please try later.");
            console.log("Timestamp is " + (await admin.getTimestamp(operationId)).toNumber());
        } else if (await admin.isOperationDone(operationId)) {
            console.log("Operation is Done.");
        }else {
            console.log("Operation is not scheduled, will schedule.");
            await hre.run("admin_schedule", args);
        }
    });

task("check_deposit")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const entrypoint = await hre.ethers.getContractAt(
            "EntryPoint",
            "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
        );
        const info = await entrypoint.getDepositInfo(hexlink.address);
        console.log({
            deposit: ethers.utils.formatEther(info.deposit),
            stake: ethers.utils.formatEther(info.stake),
            unstakeDelaySec: info.unstakeDelaySec,
            withdrawTime: new Date(info.withdrawTime).toISOString(),
        });
        return info;
    });

task("add_stake")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const artifact = await hre.artifacts.readArtifact("EntryPointStaker");
        const iface = new ethers.utils.Interface(artifact.abi);
        const entrypoint = await hre.ethers.getContractAt(
            "EntryPoint",
            "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
        );
        const data = iface.encodeFunctionData(
            'addStake', [
                entrypoint.address,
                ethers.utils.parseEther("0.05"),
                86400
            ]
        );
        console.log("Add stake 0.05 ETH to " + entrypoint.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlink.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlink.address, data });
        }
    });

task("upgrade_hexlink", "upgrade hexlink contract")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const existing = await hexlink.implementation();
        const deployed = await hre.deployments.get("Hexlink");
        if (existing.toLowerCase() == deployed.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }
        const data = hexlink.interface.encodeFunctionData(
            "upgradeTo",
            [deployed.address]
        );
        console.log("Upgrading from " + existing + " to " + deployed.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlink.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlink.address, data });
        }
    });

task("upgrade_account")
    .addFlag("nowait")
    .addOptionalParam("nameService", "nameService to update")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        let hexlink = await getHexlink(hre);
        const deployed = await hre.deployments.get("Account");
        const existing = await hexlink.getAccountImplementation();
        if (existing.toLowerCase() == deployed.address.toLowerCase()) {
            console.log("no need to upgrade account");
            return;
        }
        const data = hexlink.interface.encodeFunctionData(
            "setAccountImplementation",
            [deployed.address],
        );
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlink.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlink.address, data });
        }
    });
