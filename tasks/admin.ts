import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { getHexlink, getAdmin } from "./utils";
import { Contract } from "ethers";

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
) : Promise<[string, bigint, string, string, string, number]> {
    return [
        args.target,
        BigInt(args.value || 0),
        args.data,
        args.predecessor || ethers.ZeroHash,
        args.salt || ethers.ZeroHash,  // salt
        Number(args.delay || await timelock.getMinDelay())
    ];
}

task("admin_check", "check if has role")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        const minDelay = await admin.getMinDelay();
        const adminAddr = await admin.getAddress();
        console.log("admin is " + adminAddr + ", with min delay as " + minDelay);

        const {deployer} = await hre.getNamedAccounts();
        const controller = deployer;
        console.log("Owner of admin is " + controller);

        const isProposer = await admin.hasRole(
            ethers.keccak256(ethers.toUtf8Bytes("PROPOSER_ROLE")),
            controller
        );
        console.log(controller + " is " + (isProposer ? "" : "not ") +  "proposer");

        const isCanceller = await admin.hasRole(
            ethers.keccak256(ethers.toUtf8Bytes("CANCELLER_ROLE")),
            controller
        );
        console.log(controller + " is " + (isCanceller ? "" : "not ") +  "canceller");

        const isExecutor = await admin.hasRole(
            ethers.keccak256(ethers.toUtf8Bytes("EXECUTOR_ROLE")),
            controller
        );
        console.log(controller + " is " + (isExecutor ? "" : "not ") +  "executor");

        const isAdmin = await admin.hasRole(
            ethers.keccak256(ethers.toUtf8Bytes("TIMELOCK_ADMIN_ROLE")),
            adminAddr
        );
        console.log(adminAddr + " is " + (isAdmin ? "" : "not ") +  "admin");
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
        const processed = await processArgs(admin, args);
        await admin.schedule(...processed);
    });

task("admin_exec", "execute a tx")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre);
        const rawProcessed = await processArgs(admin, args);
        const processed = rawProcessed.slice(0, -1) as [string, bigint, string, string, string];
        await admin.execute(...processed);
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
        const delay = Number(args.dealy) || Number(await admin.getMinDelay());
        const wait = (ms: number) => {
            return new Promise( resolve => setTimeout(resolve, ms * 1000 + 2000) );
        };
        console.log("Will wait for " + delay + " seconds before exec");
        await wait(delay + 3);
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
        const operationId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes", "bytes32", "bytes32"],
                processed
            )
        );
        if (await admin.isOperationReady(operationId)) {
            console.log("Operation is ready, will execute.");
            await hre.run("admin_exec", args);
        } else if (await admin.isOperationPending(operationId)) {
            console.log("Operation is pending, please try later.");
            console.log("Timestamp is " + (await admin.getTimestamp(operationId)));
        } else if (await admin.isOperationDone(operationId)) {
            console.log("Operation is Done.");
        }else {
            console.log("Operation is not scheduled, will schedule.");
            await hre.run("admin_schedule", args);
        }
    });

task("check_deposit")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre, args.dev);
        const entrypoint = await hre.ethers.getContractAt(
            "EntryPoint",
            "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
        );
        const info = await entrypoint.getDepositInfo(
            await hexlink.getAddress()
        );
        console.log({
            deposit: ethers.formatEther(info.deposit),
            stake: ethers.formatEther(info.stake),
            unstakeDelaySec: info.unstakeDelaySec,
            withdrawTime: new Date(info.withdrawTime).toISOString(),
        });
        return info;
    });

task("add_stake")
    .addFlag("nowait")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const { deployer } = await hre.ethers.getNamedSigners();
        const hexlink = await getHexlink(hre, args.dev);
        const hexlinkAddr = await hexlink.getAddress();
        const artifact = await hre.artifacts.readArtifact("EntryPointStaker");
        const iface = new ethers.Interface(artifact.abi);
        const entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
        const balance = await hre.ethers.provider.getBalance(hexlinkAddr);
        if (balance < ethers.parseEther("0.05")) {
            console.log("depositing 0.05 ETH to " + hexlinkAddr);
            const tx = await deployer.sendTransaction({
                to: hexlinkAddr,
                value: ethers.parseEther("0.05")
            });
            await tx.wait();
        }

        console.log("Adding stake 0.05 ETH to " + entrypoint + " for " + hexlinkAddr);
        if (args.dev) {
            await hexlink.connect(deployer).addStake(
                entrypoint,
                ethers.parseEther("0.05"),
                86400,
            );
        } else {
            const data = iface.encodeFunctionData(
                'addStake', [
                    entrypoint,
                    ethers.parseEther("0.05"),
                    86400
                ]
            );
            if (args.nowait) {
                await hre.run("admin_schedule_or_exec", { target: hexlinkAddr, data });
            } else {
                await hre.run("admin_schedule_and_exec", { target: hexlinkAddr, data });
            }
        }
    });

task("upgrade_hexlink", "upgrade hexlink contract")
    .addFlag("nowait")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre, args.dev);
        const existing = await hexlink.implementation();
        const deployed = args.dev
            ? await hre.deployments.get("HexlinkDev")
            : await hre.deployments.get("Hexlink");
        if (existing.toLowerCase() == deployed.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        console.log("Upgrading from " + existing + " to " + deployed.address);
        const data = hexlink.interface.encodeFunctionData(
            "upgradeTo",
            [deployed.address]
        );
        const hexlinkAddr = await hexlink.getAddress();
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlinkAddr, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlinkAddr, data });
        }
    });

 task("changeOwner", "change account owner")
    .addFlag("nowait")
    .addParam("newowner")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre, args.dev);
        const existing = await hexlink.owner();
        if (existing.toLowerCase() == args.newowner.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        console.log("Changing owner from " + existing + " to " + args.newowner);
        const data = hexlink.interface.encodeFunctionData(
            "transferOwnership",
            [args.newowner]
        );
        const hexlinkAddr = await hexlink.getAddress();
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlinkAddr, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlinkAddr, data });
        }
    });
