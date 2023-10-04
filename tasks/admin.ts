import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { getAirdropPaymaster, getHexlink, getTimelock, hash, loadConfig } from "./utils";
import { Contract } from "ethers";
import { scheduler } from "timers/promises";

function getGasOptions(hre: HardhatRuntimeEnvironment) {
    if (hre.network.name == "bsc_test") {
        return {gasPrice: 10000000000n}// 10gwei
    }
    return {};
}

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
        const admin = await getTimelock(hre);
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
    .addOptionalParam("proposer")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        let admin = await getTimelock(hre, args.proposer);
        const processed = await processArgs(admin, args);
        const safe = loadConfig(hre, "safe");
        if (safe) {
            console.log("schedueling...");
            console.log(processed);
        } else {
            await admin.schedule(...processed, getGasOptions(hre));
        }
        return "scheduled";
    });

task("admin_exec", "execute a tx")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("executor")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getTimelock(hre, args.executor);
        const rawProcessed = await processArgs(admin, args);
        const processed = rawProcessed.slice(0, -1) as [string, bigint, string, string, string];
        const safe = loadConfig(hre, "safe");
        if (safe) {
            console.log("executing...");
            console.log(processed);
        } else {
            await admin.execute(...processed, getGasOptions(hre));
        }
        return "executed";
    });

task("admin_schedule_and_exec", "schedule and execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("proposer")
    .addOptionalParam("executor")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const timelock = await getTimelock(hre);
        const result = await hre.run("admin_schedule_or_exec", args);
        if (result != "executed") {
            const delay = (Number(args.dealy) || Number(await timelock.getMinDelay())) + 3;
            const wait = (ms: number) => {
                return new Promise( resolve => setTimeout(resolve, ms * 1000 + 2000) );
            };
            console.log("Will wait for " + delay + " seconds before exec");
            await wait(delay);
            await hre.run("admin_schedule_or_exec", args);
        }
    });

task("admin_schedule_or_exec", "schedule or execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("proposer")
    .addOptionalParam("executor")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const timelock = await getTimelock(hre);
        const processed = await processArgs(timelock, args);
        processed.pop();
        const operationId = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "uint256", "bytes", "bytes32", "bytes32"],
                processed
            )
        );
        if (await timelock.isOperationReady(operationId)) {
            console.log("Operation is ready, will execute.");
            return await hre.run("admin_exec", args);
        } else if (await timelock.isOperationPending(operationId)) {
            console.log("Operation is pending, please try later.");
            console.log("Timestamp is " + (await timelock.getTimestamp(operationId)));
            return "scheduled";
        } else if (await timelock.isOperationDone(operationId)) {
            console.log("Operation is Done.");
            return "excuted";
        }else {
            console.log("Operation is not scheduled, will schedule.");
            return await hre.run("admin_schedule", args);
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
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const { deployer } = await hre.ethers.getNamedSigners();
        const hexlink = await getHexlink(hre, args.dev);
        const hexlinkAddr = await hexlink.getAddress();
        const artifact = await hre.artifacts.readArtifact("EntryPointStaker");
        const iface = new ethers.Interface(artifact.abi);
        const entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

        console.log(hexlinkAddr);
        console.log("Adding stake 0.05 ETH to " + entrypoint + " for " + hexlinkAddr);
        const data = iface.encodeFunctionData(
            'addStake', [
                entrypoint,
                ethers.parseEther("0.05"),
                86400
            ]
        );
        await hre.run("admin_schedule_and_exec", { target: hexlinkAddr, data });
    });

task("upgrade_hexlink", "upgrade hexlink contract")
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
        await hre.run("admin_schedule_and_exec", { target: hexlinkAddr, data });
    });

task("changeOwner", "change account owner")
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
        await hre.run("admin_schedule_and_exec", { target: hexlinkAddr, data });
    });

task("rotateOwner", "ratate timelock and paymaster owner")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const {deployer, oldDeployer} = await hre.getNamedAccounts();
        const timelock = await getTimelock(hre);
        const timelockAddr = await timelock.getAddress();
        const owner = loadConfig(hre, "safe") ?? deployer;
        console.log(timelockAddr);
        console.log("new owner is: ", owner);
        console.log("old owner is: ", oldDeployer);
        console.log("old owner is executor: ", await timelock.hasRole(hash("EXECUTOR_ROLE"), oldDeployer));
        console.log("old owner is proposer: ", await timelock.hasRole(hash("PROPOSER_ROLE"), oldDeployer));
        console.log("old owner is canceller: ", await timelock.hasRole(hash("CANCELLER_ROLE"), oldDeployer));

        console.log("new owner is executor: ", await timelock.hasRole(hash("EXECUTOR_ROLE"), owner));
        console.log("new owner is proposer: ", await timelock.hasRole(hash("PROPOSER_ROLE"), owner));
        console.log("new owner is canceller: ", await timelock.hasRole(hash("CANCELLER_ROLE"), owner));

        if (!await timelock.hasRole(hash("PROPOSER_ROLE"), owner)) {
            console.log("Granting PROPOSER_ROLE role to " + owner);
            const data = timelock.interface.encodeFunctionData(
                "grantRole",
                [hash("PROPOSER_ROLE"), owner]
            );
            await hre.run(
                "admin_schedule_and_exec",
                {
                    target: timelockAddr,
                    data,
                    proposer: "oldDeployer",
                    executor: "oldDeployer",
                });
        }
        
        if (!await timelock.hasRole(hash("EXECUTOR_ROLE"), owner)) {
            console.log("Granting EXECUTOR_ROLE role to " + owner);
            const data = timelock.interface.encodeFunctionData(
                "grantRole",
                [hash("EXECUTOR_ROLE"), owner]
            );
            await hre.run(
                "admin_schedule_and_exec",
                {
                    target: timelockAddr,
                    data,
                    proposer: "oldDeployer",
                    executor: "oldDeployer",
                });
        }

        if (await timelock.hasRole(hash("EXECUTOR_ROLE"), oldDeployer)) {
            console.log("Revoking EXECUTOR_ROLE role from " + oldDeployer);
            const data = timelock.interface.encodeFunctionData(
                "revokeRole",
                [hash("EXECUTOR_ROLE"), oldDeployer]
            );
            await hre.run(
                "admin_schedule_and_exec",
                {
                    target: timelockAddr,
                    data,
                    proposer: "oldDeployer",
                    executor: "oldDeployer",
                });
        }

        if (await timelock.hasRole(hash("PROPOSER_ROLE"), oldDeployer)) {
            console.log("Revoking PROPOSER_ROLE role from " + oldDeployer);
            const data = timelock.interface.encodeFunctionData(
                "revokeRole",
                [hash("PROPOSER_ROLE"), oldDeployer]
            );
            await hre.run(
                "admin_schedule_and_exec",
                {
                    target: timelockAddr,
                    data,
                    proposer: "deployer",
                    executor: "deployer",
                });
        }

        if (!await timelock.hasRole(hash("CANCELLER_ROLE"), owner)) {
            console.log("Granting CANCELLER_ROLE role to " + owner);
            const data = timelock.interface.encodeFunctionData(
                "grantRole",
                [hash("CANCELLER_ROLE"), owner]
            );
            await hre.run(
                "admin_schedule_and_exec",
                {
                    target: timelockAddr,
                    data,
                    proposer: "deployer",
                    executor: "deployer",
                });
        }

        if (await timelock.hasRole(hash("CANCELLER_ROLE"), oldDeployer)) {
            console.log("Revoking CANCELLER_ROLE role from " + oldDeployer);
            const data = timelock.interface.encodeFunctionData(
                "revokeRole",
                [hash("CANCELLER_ROLE"), oldDeployer]
            );
            await hre.run(
                "admin_schedule_and_exec",
                {
                    target: timelockAddr,
                    data,
                    proposer: "deployer",
                    executor: "deployer",
                });
        }

        const paymaster = await getAirdropPaymaster(hre, false, "oldDeployer");
        if ((await paymaster.owner()) == oldDeployer) {
            console.log("Transferring ownership of paymaster from " + oldDeployer + " to " + owner);
            await paymaster.transferOwnership(owner);
        }
        const paymasterDev = await getAirdropPaymaster(hre, true, "oldDeployer");
        if ((await paymasterDev.owner()) == oldDeployer) {
            console.log("Transferring ownership of paymaster dev from " + oldDeployer + " to " + owner);
            await paymasterDev.transferOwnership(owner);
        }
    });