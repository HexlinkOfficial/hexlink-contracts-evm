import { task } from "hardhat/config";
import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { hash } from "./utils";

async function getEntrypoint(hre: HardhatRuntimeEnvironment) {
    // if (hre.network.name === 'hardhat') {
    //     const { deployer } = await hre.ethers.getNamedSigners();
    //     const entrypoint = await hre.deployments.deploy(
    //         "EntryPoint",
    //         { from: deployer.address, args: [], }
    //     );
    //     return entrypoint.address;
    // }
    return "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
}

function getBytecode(artifact: Artifact, args: string | []) {
    return ethers.utils.solidityPack(
        ["bytes", "bytes"],
        [artifact.bytecode, args]
    );
}

function genSalt(id: string) {
    const salt = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['string'], [id])
    );
    return ethers.BigNumber.from(salt);
}

async function getValidator(hre: HardhatRuntimeEnvironment) {
    let validator = await hre.run("loadConfig", { key: "validator" });
    if (validator == undefined) {
        return (await hre.getNamedAccounts())["validator"];
    }
    return validator;
}

async function isContract(hre: HardhatRuntimeEnvironment, address: string) {
    try {
        const code = await hre.ethers.provider.getCode(address);
        if (code !== '0x') return true;
    } catch (error) { }
    return false;
}

async function getFactory(hre: HardhatRuntimeEnvironment) {
    const factoryDeployed = await hre.deployments.get("ContractFactory");
    return await hre.ethers.getContractAt(
        "ContractFactory",
        factoryDeployed.address
    );
}

task("deployNameRegistry", "deploy name registry contract")
    .addParam("name", "registry contract name")
    .addParam("admin", "admin contract address")
    .addParam("schema", "schema of the registry")
    .addOptionalParam("domain", "domain of the registry")
    .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { deployer } = await hre.ethers.getNamedSigners();
        // deploy email name registry
        const deployedRegistry = await deployments.deploy(
            args.name,
            {
                from: deployer.address,
                contract: "NameRegistry",
                args: [],
                log: true,
                autoMine: true
            }
        );
        const registry = await hre.ethers.getContractAt(
            "NameRegistry",
            deployedRegistry.address
        );

        if (await registry.owner() === ethers.constants.AddressZero) {
            const schema = hash(args.schema);
            const domain = args.domain ? hash(args.domain) : ethers.constants.HashZero;
            const validator = await getValidator(hre);
            await registry.connect(deployer).init(
                schema,
                domain,
                args.admin,
                [validator]
            );
            console.log(
                `NameRegistry initiated with ` +
                `schema=${schema}, ` +
                `domain=byts32(0), ` +
                `owner=${args.admin}, ` +
                `validator=${validator}`
            );
        } else {
            console.log(`NameRegistry already initiated`)
        }
        return registry.address;
    });

task("deployHexlinkProxy", "deploy hexlink proxy contract")
    .addOptionalParam("implementation", "the hexlink implementation address")
    .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
        const { artifacts, ethers } = hre;
        const factory = await getFactory(hre);
        const { deployer } = await hre.ethers.getNamedSigners();

        // 1. deploy a dummy uups implementation
        const bytescode5 = getBytecode(
            await artifacts.readArtifact("DummyUUPSImpl"),
            []
        );
        const salt5 = genSalt('hexlink.dummyImpl');
        const dummyImpl = await factory.getAddress(bytescode5, salt5);
        if (await isContract(hre, dummyImpl)) {
            console.log(`Reusing "DummyUUPSImpl" deployed at ${dummyImpl}`);
        } else {
            const tx5 = await factory.connect(deployer).deploy(bytescode5, salt5);
            await tx5.wait();
            console.log(`deploying "DummyImpl" (tx: ${tx5.hash})...: deployed at ${dummyImpl}`);
        }

        // 2. deploy a ERC1967Proxy with dummy implementation
        const bytecode6 = getBytecode(
            await artifacts.readArtifact("ERC1967Proxy"),
            ethers.utils.defaultAbiCoder.encode(
                ["address", "bytes"],
                [dummyImpl, []]
            )
        );
        const salt6 = genSalt('hexlink.proxy');
        const hexlinkProxy = await factory.getAddress(bytecode6, salt6);
        if (await isContract(hre, hexlinkProxy)) {
            console.log(`Reusing "HexlinkProxy" deployed at ${hexlinkProxy}`);
        } else {
            const tx6 = await factory.connect(deployer).deploy(bytecode6, salt6);
            await tx6.wait();
            console.log(`deploying "HexlinkProxy" (tx: ${tx6.hash})...: deployed at ${hexlinkProxy}`);
        }

        // 3. upgrade a ERC1967Proxy to official implementation
        const hexlink = await hre.ethers.getContractAt("DummyUUPSImpl", hexlinkProxy);
        if (await hexlink.implementation() === dummyImpl) {
            await hexlink.upgradeTo(args.implementation);
        }
        return hexlinkProxy;
    });

task("deployAll", "deploy hexlink related contracts")
    .setAction(async (_args, hre: HardhatRuntimeEnvironment) => {
        const { artifacts, ethers } = hre;
        const { deployer } = await hre.ethers.getNamedSigners();
        const factory = await getFactory(hre);

        // deploy admin
        const bytecode0 = getBytecode(
            await artifacts.readArtifact("TimelockController"),
            ethers.utils.defaultAbiCoder.encode(
                ["uint256", "address[]", "address[]", "address"],
                [0, [deployer.address], [deployer.address], ethers.constants.AddressZero]
            )
        );
        const salt0 = genSalt('hexlink.admin');
        const admin = await factory.getAddress(bytecode0, salt0);
        if (await isContract(hre, admin)) {
            console.log(`Reusing "TimelockController" deployed at ${admin}`);
        } else {
            const tx0 = await factory.connect(deployer).deploy(bytecode0, salt0);
            await tx0.wait();
            console.log(`deploying "TimelockController" (tx: ${tx0.hash})...: deployed at ${admin}`);
        }

        // deploy account implementation
        const bytecode1 = getBytecode(
            await artifacts.readArtifact("Account"),
            ethers.utils.defaultAbiCoder.encode(
                ["address"],
                [await getEntrypoint(hre)]
            )
        );
        const salt1 = genSalt('hexlink.account.implementation');
        const accountImpl = await factory.getAddress(bytecode1, salt1);
        if (await isContract(hre, accountImpl)) {
            console.log(`Reusing "Account" deployed at ${accountImpl}`);
        } else {
            const tx1 = await factory.connect(deployer).deploy(bytecode1, salt1);
            await tx1.wait();
            console.log(`deploying "Account" (tx: ${tx1.hash})...: deployed at ${accountImpl}`);
        }

        // deploy account beacon
        const bytecode2 = getBytecode(
            await artifacts.readArtifact("AccountBeacon"),
            ethers.utils.defaultAbiCoder.encode(["address"], [admin])
        );
        const salt2 = genSalt('hexlink.account.beacon');
        const accountBeacon = await factory.getAddress(bytecode2, salt2);
        if (await isContract(hre, accountBeacon)) {
            console.log(`Reusing "AccountBeacon" deployed at ${accountBeacon}`);
        } else {
            const tx2 = await factory.connect(deployer).deploy(bytecode2, salt2);
            await tx2.wait();
            console.log(`deploying "AccountBeacon" (tx: ${tx2.hash})...: deployed at ${accountBeacon}`);
        }
    
        const beacon = await ethers.getContractAt("AccountBeacon", accountBeacon);
        if (await beacon.owner() === ethers.constants.AddressZero) {
            await beacon.init(admin, accountImpl);
            console.log(`"AccountBeacon" initiated with owner=${admin}, implementation=${accountImpl}`);
        }

        // deploy account proxy
        const bytecode3 = getBytecode(
            await artifacts.readArtifact("AccountProxy"),
            ethers.utils.defaultAbiCoder.encode(["address"], [accountBeacon])
        );
        const salt3 = genSalt('hexlink.account.proxy');
        const accountProxy = await factory.getAddress(bytecode3, salt3);
        if (await isContract(hre, accountProxy)) {
            console.log(`Reusing "AccountProxy" deployed at ${accountProxy}`);
        } else {
            const tx3 = await factory.connect(deployer).deploy(bytecode3, salt3);
            await tx3.wait();
            console.log(`deploying "AccountProxy" (tx: ${tx3.hash})...: deployed at ${accountProxy}`);
        }

        // deploy hexlink implementation
        const bytecode4 = getBytecode(
            await artifacts.readArtifact("Hexlink"),
            ethers.utils.defaultAbiCoder.encode(["address"], [accountProxy])
        );
        const salt4 = genSalt('hexlink.implementation');
        const hexlinkImpl = await factory.getAddress(bytecode4, salt4);
        if (await isContract(hre, hexlinkImpl)) {
            console.log(`Reusing "Hexlink" deployed at ${hexlinkImpl}`);
        } else {
            const tx4 = await factory.connect(deployer).deploy(bytecode4, salt4);
            await tx4.wait();
            console.log(`deploying "Hexlink" (tx: ${tx4.hash})...: deployed at ${hexlinkImpl}`);
        }

        // deploy hexlink proxy
        const hexlinkProxy = await hre.run(
            "deployHexlinkProxy",
            {implementation: hexlinkImpl}
        );

        // deploy email name registry
        const registry = await hre.run(
            "deployNameRegistry",
            {admin, name: "EmailNameRegistry", schema: "mailto"}
        );

        // init hexlink
        const hexlink = await hre.ethers.getContractAt("Hexlink", hexlinkProxy);
        if (await hexlink.owner() === ethers.constants.AddressZero) {
            await hexlink.connect(deployer).init(admin, [registry]);
            console.log(
                `HexlinkProxy initiated with ` +
                `owner=${admin}, ` +
                `registries=${registry}`
            );
        } else {
            console.log(`Hexlink already initiated`);
        }

        return {
            admin,
            accountProxy,
            accountImpl,
            accountBeacon,
            hexlinkImpl,
            hexlinkProxy
        }
    });