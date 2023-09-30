import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import * as config from '../config.json';
import { Contract } from "ethers";

export function epoch() {
  return Math.round(Date.now() / 1000);
}

export function hash(value: string) {
    return ethers.keccak256(ethers.toUtf8Bytes(value));
}

export async function getAbi(
  hre: HardhatRuntimeEnvironment,
  contract: string
) {
  const artifact = await hre.artifacts.readArtifact(contract);
  return  artifact.abi;
}

export function nameHash(name: {schema: string, domain: string, handle: string}) : string {
    return ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "bytes32", "bytes32"],
          [name.schema, name.domain, name.handle]
        )
    );
}

export function loadConfig(hre: HardhatRuntimeEnvironment, key: string) : any {
  if (hre.network.name == "hardhat") {
    return undefined;
  }
  let netConf = config[hre.network.name as keyof typeof config] || {};
  let value = (netConf as any)[key];
  if (!value) {
    netConf = config.common || {};
    value = (netConf as any)[key];
  }
  return value;
}

export function getBytecode(artifact: Artifact, args: string) {
  return ethers.solidityPacked(
      ["bytes", "bytes"],
      [artifact.bytecode, args]
  );
}

export async function getValidator(hre: HardhatRuntimeEnvironment, name?: string) {
  let validator = loadConfig(hre, name || "dauthValidator");
  if (validator == undefined) {
      return (await hre.getNamedAccounts())["validator"];
  }
  return validator;
}

export async function getEntryPoint(hre: HardhatRuntimeEnvironment) {
  let entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  if (hre.network.name === 'hardhat') {
      const deployed = await hre.deployments.get("EntryPoint");
      entrypoint = deployed.address;
  }
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    entrypoint,
    await getAbi(hre, "EntryPoint"),
    deployer
  );
}

export async function getAirdrop(hre: HardhatRuntimeEnvironment, signer?: any) {
  const salt = hash("airdrop");
  const { deployer } = await hre.ethers.getNamedSigners();
  const factory = await getFactory(hre);
  const bytecode = getBytecode(
      await hre.artifacts.readArtifact("HexlinkERC1967Proxy"), '0x'
  );
  return new Contract(
    await factory.calculateAddress(bytecode, salt),
    await getAbi(hre, "Airdrop"),
    signer ?? deployer
  );
}

export async function getHexlink(hre: HardhatRuntimeEnvironment, dev: boolean = false) {
  let hexlink = loadConfig(hre, dev ? "hexlinkDev" : "hexlink");
  if (hexlink === undefined) {
    const salt = dev ? hash("hexlink.dev") : hash("hexlink.prod");
    hexlink = await getHexlinkProxyAddr(hre, salt);
  }
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    hexlink,
    await getAbi(hre, "Hexlink"),
    deployer
  );
}

async function getHexlinkProxyAddr(hre: HardhatRuntimeEnvironment, salt: string) {
  const factory = await getFactory(hre);
  const bytecode = getBytecode(
      await hre.artifacts.readArtifact("HexlinkERC1967Proxy"), '0x'
  );
  return await factory.calculateAddress(bytecode, salt);
}

export async function getAdmin(hre: HardhatRuntimeEnvironment) {
  let admin = loadConfig(hre, "admin");
  if (admin === undefined) {
      const deployed = await hre.deployments.get("HexlinkAdmin");
      admin = deployed.address;
  }
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    admin,
    await getAbi(hre, "TimelockController"),
    deployer
  );
}

export async function getFactory(hre: HardhatRuntimeEnvironment) {
  let factory = loadConfig(hre, "contractFactory");
  if (factory === undefined) {
    const deployed = await hre.deployments.get("HexlinkContractFactory");
    factory = deployed.address;
  }
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    factory,
    await getAbi(hre, "HexlinkContractFactory"),
    deployer
  );
}

export async function deterministicDeploy(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  alias: string,
  salt: string,
  args?: string,
  data?: string,
) : Promise<{address: string, deployed: boolean}> {
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args ?? "0x");
  const address = await factory.calculateAddress(bytecode, salt);
  if (await isContract(hre, address)) {
      console.log(`Reusing ${alias} deployed at ${address}`);
      return { deployed: false, address };
  } else {
      const tx = await factory.deployAndCall(
        bytecode, salt, data || "0x");
      await tx.wait();
      console.log(`deploying ${alias} (tx: ${tx.hash})...: deployed at ${address}`);
      return { deployed: true, address };
  }
}

export async function getDeterministicAddress(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  salt: string,
  args: string,
) {
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args ?? '0x');
  return await factory.calculateAddress(bytecode, salt);
}

export async function isContract(hre: HardhatRuntimeEnvironment, address: string) {
  try {
      const code = await hre.ethers.provider.getCode(address);
      if (code !== '0x') return true;
  } catch (error) { }
  return false;
}
