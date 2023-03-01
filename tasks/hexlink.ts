import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, Contract } from "ethers";

const HEXLINK : {[key: string]: string} = {
    "goerli": "0xbad6a7948a1d3031ee7236d0180b6271fa569148",
    "mumbai": "0x78317ef8b020Fe10e845ab8723403cF1e58Ef1Cc",
}

function hash(value: string) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

const getHexlink = async function(
    hre: HardhatRuntimeEnvironment
): Promise<Contract> {
    let address = HEXLINK[hre.network.name];
    if (!address) {
        address = (await hre.deployments.get("Hexlink")).address;
    }
    return await hre.ethers.getContractAt(
        "HexlinkUpgradeable",
        ethers.utils.getAddress(address)
    );
}

const getDefaultAddress = async function(
    hexlink: string,
    name: string,
    hre: HardhatRuntimeEnvironment
): Promise<string> {
    const artifact = await hre.artifacts.readArtifact("AccountProxy");
    const initCodeHash = ethers.utils.keccak256(artifact.bytecode);
    return ethers.utils.getCreate2Address(
        hexlink, hash(name), initCodeHash
    );
}

const processTx = async function(tx: any) {
    const receipt = await tx.wait();
    const gas = receipt.gasUsed.mul(
        receipt.effectiveGasPrice
    ).div(1000000000);
    console.log(
        // eslint-disable-next-line max-len
        `Processed transaction (tx: ${tx.hash}) with ${gas} gas`
    );
}

task("hexlink", "get hexlink contract address")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        return await getHexlink(hre);
    });

task("hexlink_check", "check hexlink metadata")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const beacon = await hre.ethers.getContractAt(
            "AccountBeacon",
            (await hre.deployments.get("AccountBeacon")).address
        );
        const oracleRegistryAddr = await hexlink.oracleRegistry();
        const registry = await hre.ethers.getContractAt(
            "IdentityOracleRegistry",
            oracleRegistryAddr
        );
        const result = {
            "address": hexlink.address,
            "accountBase": await hexlink.accountBase(),
            "accountBeacon": await beacon.address,
            "accountImpl": await beacon.implementation(),
            "oracleRegistry": oracleRegistryAddr,
            "oracles": {
                "emailOtp": await registry.oracle(
                    {identityType: hash("email"), authType: hash("otp")}
                ),
                "twitterOauth": await registry.oracle(
                    {identityType: hash("twitter.com"), authType: hash("oauth")}
                ),
            },
            "authConfig": {
                twoStageLock: (await hexlink.twoStageLock()).toNumber(),
                ttl: (await hexlink.ttl()).toNumber(),
            },
            "owner": await hexlink.owner(),
            "implementation": await hexlink.implementation(),
            "token": (await hre.deployments.get("HexlinkToken")).address
        }
        console.log(result);
        return result;
    });

task("account", "Prints account address")
    .addParam("name")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const nameHash = hash(args.name);
        const hexlink = await getHexlink(hre);
        console.log("name hash is " + nameHash);
        const account = await hexlink.addressOfName(nameHash);
        console.log("account is " + account);
        return account;
    });

task("nonce", "get current nonce")
    .addParam("name")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const hexlink = await getHexlink(hre);
        const nameHash = hash(args.name);
        return await hexlink.nonce(nameHash);
    });

task("bumpNonce", "bump nonce for a name")
    .addParam("name")
    .addParam("proof", "the auth proof")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const {deployer} = await hre.getNamedAccounts();
        const hexlink = await getHexlink(hre);
        const nameHash = hash(args.name);
        const tx = await hexlink.connect(deployer).bumpNonce(
            nameHash,
            args.proof
        );
        await processTx(tx);
        return await hexlink.connect(deployer).nonce(nameHash);
    });

task("deployAccount", "deploy a new account per given email")
    .addParam("name")
    .addParam("owner")
    .addParam("proof", "the auth proof")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const {deployer} = await hre.getNamedAccounts();
        const hexlink = await getHexlink(hre);

        const nameHash = hash(args.name);
        const initData = hexlink.interface.encodeFunctionData(
            "init", [args.owner]
        );
        const tx = await hexlink.connect(deployer).deploy(
            nameHash,
            initData,
            args.proof
        );
        await processTx(tx);
        const account = getDefaultAddress(hexlink.address, args.name, hre);
        return account;
    });

task("resetAccount", "reset the account address")
    .addParam("name")
    .addParam("account")
    .addParam("proof")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const {deployer} = await hre.getNamedAccounts();
        const hexlink = await getHexlink(hre);
        const nameHash = hash(args.name);
        const tx = await hexlink.connect(deployer).reset(
            nameHash,
            args.account,
            args.proof
        );
        await processTx(tx);
    });

task("reset2Fac", "reset the account address with 2fac")
    .addParam("name")
    .addParam("account")
    .addParam("proof1")
    .addParam("proof2")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const {deployer} = await hre.getNamedAccounts();
        const hexlink = await getHexlink(hre);
        const nameHash = hash(args.name);
        const tx = await hexlink.connect(deployer).reset(
            nameHash,
            args.account,
            args.proof1,
            args.proof2
        );
        await processTx(tx);
    });

task("reset2Stage", "reset the account address with 2fac")
    .addParam("name")
    .addParam("account")
    .addParam("authProof")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const {deployer} = await hre.getNamedAccounts();
        const hexlink = await getHexlink(hre);
        const nameHash = hash(args.name);
        const tx = await hexlink.connect(deployer).reset2Stage(
            nameHash,
            args.account,
            args.authProof
        );
        await processTx(tx);
    });

const senders = [
  "0x0114b47e901d803ba36fd4676f309ad53cd607a2",
  "0x6014fbb0f616a8c04f3de654c6d7b37e7b40b0d7",
  "0xab503575205f0d5d3463d500058f5ecce4172082",
  "0xda31a3fed6d37ed8cfcff2bc49c52f04d06bc587",
  "0xd3dcda0bda4981872adf19f33df37cf72b01b5a6",
  "0x8e30a6db366be3d49f9b0b34134d287d77d2c033",
  "0x356ce1a08222c18389aa8c259f002f218aedc660",
  "0x82d8df019f6f70185887ef4bcd05e8a372661f73",
  "0x13394d0d20a1aa92ec64db98d5ef4781389af964",
  "0x6df8bc42ba9e438bf14375b07fd06a5bc37e8c35",
];

task("depositGasPool", "deposit to senders")
    .addOptionalParam("amount")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const { deployer } = await hre.ethers.getNamedSigners();
        const amount = args.amount || "0.1";
        const value = ethers.utils.parseEther(amount);
        const total = value.mul(senders.length);
        const ops = senders.map(sender => ({
            to: sender,
            value,
            callData: [],
            callGasLimit: 0
        }));
        const hexlink = await getHexlink(hre);
        const tx = await hexlink.connect(deployer).process(
          ops, {value: total}
        );
        await tx.wait();
        console.log(tx.hash);
        for (let i = 0; i < senders.length; i++) {
            const balance = await hre.ethers.provider.getBalance(senders[i]);
            console.log(balance.toString());
        }
    });
