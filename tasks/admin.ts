import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, BigNumber, Signer, Contract } from "ethers";
import config from '../config.json';

import EthersAdapter from '@safe-global/safe-ethers-lib'
import Safe from '@safe-global/safe-core-sdk'
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types'
import SafeServiceClient, {
    ProposeTransactionProps,
    SafeInfoResponse,
  } from '@safe-global/safe-service-client';

import * as fs from 'fs';

function hash(value: string) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
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

function netConf(hre: HardhatRuntimeEnvironment) {
    return config[hre.network.name as keyof typeof config] || {};
}

async function getAdminContract(hre: HardhatRuntimeEnvironment) {
    const adminDeployed = await hre.deployments.get("HexlinkAdmin");
    return await hre.ethers.getContractAt(
        "TimelockController",
        adminDeployed.address
    );
}

async function safeService(
    hre: HardhatRuntimeEnvironment,
    ethAdapter: EthersAdapter
) : Promise<SafeServiceClient> {
    return new SafeServiceClient({
        txServiceUrl: netConf(hre)["safeApi"],
        ethAdapter
    });
}

async function getSafe(
    hre: HardhatRuntimeEnvironment,
    signer: Signer
) : Promise<{safe: Safe, safeService: SafeServiceClient, safeInfo: SafeInfoResponse}> {
    const ethAdapter = new EthersAdapter({ethers, signerOrProvider: signer})
    const safe = await Safe.create({
        ethAdapter,
        safeAddress: netConf(hre)["safe"]
    });
    const service = await safeService(hre, ethAdapter)
    const info: SafeInfoResponse = await service.getSafeInfo(netConf(hre)["safe"])
    return {safe, safeService: service, safeInfo: info};
}

async function proposeOrExectueSafeTx(
    hre: HardhatRuntimeEnvironment,
    signer: Signer,
    tx: SafeTransactionDataPartial
) {
    const { safe, safeService, safeInfo } = await getSafe(hre, signer);

    const senderAddress = await (safe.getEthAdapter()).getSignerAddress();
    if (senderAddress == undefined) {
        throw "No signer found for safe transaction";
    }
    if (safeInfo.owners.find(
        (owner) => owner.toLowerCase() === senderAddress.toLowerCase()
    ) == undefined) {
        throw "Signer is not owner of safe";
    }

    const safeTransaction = await safe.createTransaction({ safeTransactionData: tx });
    const signedSafeTransaction = await safe.signTransaction(safeTransaction);
    console.log("Signed safe transaction is ");
    console.log(signedSafeTransaction);

    // if threshold = 1, execute directly
    if (safeInfo.threshold == 1) {
        const executeTxResponse = await safe.executeTransaction(safeTransaction)
        await executeTxResponse.transactionResponse?.wait();
        return;
    }

    // else propose for other owners to confirm
    const safeTxHash = await safe.getTransactionHash(signedSafeTransaction);

    const senderSignature = signedSafeTransaction.signatures.get(senderAddress!);
    if (senderSignature == undefined) {
        throw "Signature not find at transaction";
    }
    const safeAddress = safe.getAddress();
    const transactionConfig: ProposeTransactionProps = {
        safeAddress,
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderAddress,
        senderSignature: senderSignature.data
      }
    return await safeService.proposeTransaction(transactionConfig);
}

task("admin_check", "check if has role")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdminContract(hre);
        const minDelay = await admin.getMinDelay();
        console.log("admin is " + admin.address + ", with min delay as " + minDelay);

        const { deployer } = await hre.ethers.getNamedSigners();
        const safe = netConf(hre)["safe"]
            ? ethers.utils.getAddress(netConf(hre)["safe"])
            : deployer.address;
        console.log("Owner of admin is " + safe);

        const isProposer = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROPOSER_ROLE")),
            safe
        );
        console.log(safe + " is " + (isProposer ? "" : "not ") +  "proposer");

        const isCanceller = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CANCELLER_ROLE")),
            safe
        );
        console.log(safe + " is " + (isCanceller ? "" : "not ") +  "canceller");

        const isExecutor = await admin.hasRole(
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE")),
            safe
        );
        console.log(safe + " is " + (isExecutor ? "" : "not ") +  "executor");

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
        const admin = await getAdminContract(hre);
        const { deployer } = await hre.ethers.getNamedSigners();
        const processed = await processArgs(admin, args);
        if (netConf(hre)["safe"]) {
            const data = admin.interface.encodeFunctionData(
                "schedule",
                processed
            );
            console.log("to: ", admin.address);
            console.log("data: ", data);
            await proposeOrExectueSafeTx(hre, deployer, {
                to: admin.address,
                value: "0",
                data
            });
        } else {
            await admin.connect(deployer).schedule(...processed);
        }
    });

task("admin_exec", "execute a tx")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdminContract(hre);
        const { deployer } = await hre.ethers.getNamedSigners();
        const processed = await processArgs(admin, args);
        processed.pop();
        if (netConf(hre)["safe"]) {
            const data = admin.interface.encodeFunctionData(
                "execute",
                processed
            );
            console.log("to: ", admin.address);
            console.log("data: ", data);
            await proposeOrExectueSafeTx(hre, deployer, {
                to: admin.address,
                value: "0",
                data
            });
        } else {
            await admin.connect(deployer).execute(...processed);
        }
    });

task("admin_schedule_and_exec", "schedule and execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdminContract(hre);
        await hre.run("admin_schedule", args);
        function wait(ms: number) {
            return new Promise( resolve => setTimeout(resolve, ms * 1000 + 2000) );
        }
        const delay = Number(args.dealy) || (await admin.getMinDelay()).toNumber();
        console.log("Will wait for " + delay + " seconds before exec");
        await wait(delay + 1);
        await hre.run("admin_exec", args);
    });

task("admin_schedule_or_exec", "schedule and execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdminContract(hre);
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

task("register_oracle", "register oracle contract for identity and auth type")
    .addParam("identity")
    .addParam("auth")
    .addParam("oracle")
    .addFlag("nowait")
    .setAction(async (args: any, hre : HardhatRuntimeEnvironment) => {
        const deployment = await hre.deployments.get("IdentityOracleRegistry");
        const registry = await hre.ethers.getContractAt(
            "IdentityOracleRegistry",
            deployment.address
        );
        const data = registry.interface.encodeFunctionData(
            "regsiter",
            [{
                identityType: hash(args.identity),
                authType: hash(args.auth)
            }, ethers.utils.getAddress(args.oracle)]
        )
        if (args.wait) {
            await hre.run("admin_schedule_or_exec", { target: registry.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: registry.address, data });
        }
    });

task("register_validator", "register validator at oracle contract")
    .addParam("oracle")
    .addParam("validator")
    .addFlag("registered")
    .addFlag("nowait")
    .setAction(async (args: any, hre : HardhatRuntimeEnvironment) => {
        const oracle = await hre.ethers.getContractAt("SimpleIdentityOracle", args.oracle);
        const data = oracle.interface.encodeFunctionData(
            "register",
            [ethers.utils.getAddress(args.validator), args.registered]
        )
        const registered = await oracle.isRegistered(args.validator);
        if (registered) {
            console.log("Already registered, skipping ");
            return;
        }
        console.log("Registering valdiator " + args.validator + " at oracle " + args.oracle);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: oracle.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: oracle.address, data });
        }
    });

task("set_oracle_registry", "set oracle registry")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const deployment = await hre.deployments.get("HexlinkProxy");
        const hexlink = await hre.ethers.getContractAt(
            "HexlinkUpgradeable",
            ethers.utils.getAddress(deployment.address)
        );
        const registry = await hre.deployments.get("IdentityOracleRegistry");
        const data = hexlink.interface.encodeFunctionData(
            "setOracleRegistry",
            [registry.address]
        );
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlink.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlink.address, data });
        }
    });

task("upgrade_hexlink", "upgrade hexlink contract")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        await hre.run("deploy", {tags: "CORE"});
        const impl = await hre.deployments.get("HexlinkUpgradeable");
        const hexlink = await hre.run("hexlink", {});
        const existing = await hexlink.implementation();
        if (existing.toLowerCase() == impl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        // upgrade hexlink proxy
        const data = hexlink.interface.encodeFunctionData(
            "upgradeTo",
            [impl.address]
        );
        console.log("Upgrading from " + existing + " to " + impl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlink.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlink.address, data });
        }
    });

task("upgrade_account", "upgrade account implementation")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const deployment = await hre.deployments.get("AccountBeacon");
        const beacon = await hre.ethers.getContractAt(
            "AccountBeacon", deployment.address
        );

        await hre.run("deploy", {tags: "ACCOUNT"});
        const accountImpl = await hre.deployments.get("AccountSimple");
        const existing = await beacon.implementation();
        if (existing.toLowerCase() === accountImpl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        const data = beacon.interface.encodeFunctionData(
            "upgradeTo",
            [accountImpl.address]
        );
        console.log("Upgrading from " + existing + " to " + accountImpl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: beacon.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: beacon.address, data });
        }
    });

task("upgrade_redpacket", "upgrade redpacket implementation")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const redpacket = await hre.run("redpacket", {});

        await hre.run("deploy", {tags: "APP"});
        const impl = await hre.deployments.get("HappyRedPacketImpl");
        const existing = await redpacket.implementation();
        if (existing.toLowerCase() == impl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        const data = redpacket.interface.encodeFunctionData(
            "upgradeTo",
            [impl.address]
        );
        console.log("Upgrading from " + existing + " to " + impl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: redpacket.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: redpacket.address, data });
        }
    });

task("set_erc721_impl", "set erc721 base")
    .addFlag("nowait")
    .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
        const factory = await hre.run("token_factory", {});
        await hre.run("deploy", {tags: "ERC721"});

        const newImpl = await hre.deployments.get("HexlinkErc721Proxy");
        const existing = await factory.erc721Impl();
        if (existing.toLowerCase() == newImpl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }
        const data = factory.interface.encodeFunctionData(
            "setErc721Impl",
            [newImpl.address]
        );
        console.log("Upgrading from " + existing + " to " + newImpl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: factory.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: factory.address, data });
        }
    });

task("upgrade_erc721", "upgrade erc721 beacon implementation")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const deployment = await hre.deployments.get("HexlinkErc721Beacon");
        const beacon = await hre.ethers.getContractAt(
            "HexlinkErc721Beacon", deployment.address
        );

        await hre.run("deploy", {tags: "ERC721"});
        const newImpl = await hre.deployments.get("HexlinkErc721Impl");
        const existing = await beacon.implementation();
        if (existing.toLowerCase() === newImpl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        const data = beacon.interface.encodeFunctionData(
            "upgradeTo",
            [newImpl.address]
        );
        console.log("Upgrading from " + existing + " to " + newImpl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: beacon.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: beacon.address, data });
        }
    });

task("upgrade_token_factory", "upgrade token factory implementation")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const factory = await hre.run("token_factory", {});
        await hre.run("deploy", {tags: "TOKEN"});
        const impl = await hre.deployments.get("HexlinkTokenFactoryImpl");
        const existing = await factory.implementation();
        if (existing.toLowerCase() == impl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }
        const data = factory.interface.encodeFunctionData(
            "upgradeTo",
            [impl.address]
        );
        console.log("Upgrading from " + existing + " to " + impl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: factory.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: factory.address, data });
        }
    });

task("upgrade_swap", "upgrade swap implementation")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const deployment = await hre.deployments.get("HexlinkSwapProxy");
        const proxy = await hre.ethers.getContractAt(
            "HexlinkSwapImpl", deployment.address
        );

        await hre.run("deploy", {tags: "SWAP"});
        const impl = await hre.deployments.get("HexlinkSwapImpl");
        const existing = await proxy.implementation();
        if (existing.toLowerCase() == impl.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }
        const data = proxy.interface.encodeFunctionData(
            "upgradeTo",
            [impl.address]
        );
        console.log("Upgrading from " + existing + " to " + impl.address);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: proxy.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: proxy.address, data });
        }
    });

task("set_swap_prices", "set prices of gas token")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const deployment = await hre.deployments.get("HexlinkSwapProxy");
        const swap = await hre.ethers.getContractAt(
            "HexlinkSwapImpl", deployment.address
        );
        const gasTokens = (netConf as any)(hre)["gasTokens"] || [];
        if (gasTokens.length == 0) {
            console.log("no gas token found, exiting...");
            return;
        }
        const tokens = gasTokens.map((t : any) => t.address);
        const prices = gasTokens.map((t : any) => t.price);
        const { deployer } = await hre.ethers.getNamedSigners();
        const {gasPrice} = await hre.ethers.provider.getFeeData();
        await swap.connect(deployer).setPrices(tokens, prices);
        await swap.connect(deployer).deposit(
            {value: ethers.utils.parseEther("0.01"), gasPrice}
        );
    });