import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, BigNumber, Contract } from "ethers";
import { hash, getHexlink, getAdmin } from "./utils";

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
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre, undefined);
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
    .addOptionalParam("admin")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre, args.admin);
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
    .addOptionalParam("admin")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre, args.admin);
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
    .addOptionalParam("admin")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre, args.admin);
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

task("admin_schedule_or_exec", "schedule and execute")
    .addParam("target")
    .addParam("data")
    .addOptionalParam("value")
    .addOptionalParam("predecessor")
    .addOptionalParam("salt")
    .addOptionalParam("delay")
    .addOptionalParam("admin")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const admin = await getAdmin(hre, args.admin);
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

task("register_validator", "register validator at oracle contract")
    .addParam("registry")
    .addParam("validator")
    .addFlag("registered")
    .addFlag("nowait")
    .setAction(async (args: any, hre : HardhatRuntimeEnvironment) => {
        const registry = await hre.ethers.getContractAt("NameRegistry", args.registry);
        const data = registry.interface.encodeFunctionData(
            "registerValidator",
            [ethers.utils.getAddress(args.validator), args.registered]
        )
        const registered = await registry.isRegistered(args.validator);
        if (registered) {
            console.log("Already registered, skipping ");
            return;
        }
        console.log("Registering valdiator " + args.validator + " at registry " + args.registry);
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: registry.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: registry.address, data });
        }
    });

task("set_registry", "set name registry")
    .addParam("schema")
    .addFlag("nowait")
    .addOptionalParam("domain")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const registry = await hre.deployments.get("IdentityOracleRegistry");
        const domain = args.domain ? hash(args.domain) : ethers.constants.HashZero;
        const data = hexlink.interface.encodeFunctionData(
            "setRegistry",
            [hash(args.schema), domain, registry.address]
        );
        if (args.nowait) {
            await hre.run("admin_schedule_or_exec", { target: hexlink.address, data });
        } else {
            await hre.run("admin_schedule_and_exec", { target: hexlink.address, data });
        }
    });

task("add_stake")
    .addFlag("nowait")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const entrypoint = await hre.ethers.getContractAt(
            "EntryPoint",
            "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
        );
        const data = hexlink.interface.encodeFunctionData(
            'exec', [
                entrypoint.address,
                ethers.utils.parseEther("0.05"),
                entrypoint.interface.encodeFunctionData("addStake", [86400])
            ]
        )
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

        const proxy = await hre.ethers.getContractAt(
            "HexlinkERC1967Proxy",
            hexlink.address
        );
        const existing = await proxy.implementation();
        const deployed = await hre.deployments.get("Hexlink");
        if (existing.toLowerCase() == deployed.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }

        // upgrade hexlink proxy
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