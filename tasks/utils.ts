import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import * as config from '../config.json';
import {
  HexlinkContractFactory__factory,
} from "../typechain-types";

export function hash(value: string) {
    return ethers.keccak256(ethers.toUtf8Bytes(value));
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
  let netConf = config[hre.network.name as keyof typeof config] || {};
  return (netConf as any)[key];
}

export function getBytecode(artifact: Artifact, args: string) {
  return ethers.solidityPacked(
      ["bytes", "bytes"],
      [artifact.bytecode, args]
  );
}

export async function getValidator(hre: HardhatRuntimeEnvironment, name?: string) {
  let validator = loadConfig(hre, name || "dauthValidator");
  if (hre.network.name == "hardhat" || validator == undefined) {
      return (await hre.getNamedAccounts())["validator"];
  }
  return validator;
}

export async function getHexlink(hre: HardhatRuntimeEnvironment, isDev?: boolean) {
  if (isDev) {
    const salt = hash("dev.hexlink.Hexlink");
    return await getHexlinkImpl(hre, salt);
  } else {
    const salt = hash("hexlink.Hexlink");
    return await getHexlinkImpl(hre, salt);
  }
}

async function getHexlinkImpl(hre: HardhatRuntimeEnvironment, salt: string) {
  const factory = await getFactory(hre);
  const bytecode = getBytecode(
      await hre.artifacts.readArtifact("HexlinkERC1967Proxy"), "0x"
  );
  const hexlink = await factory.getAddress(bytecode, salt);
  return getContractAt(hre, "Hexlink", hexlink);
}

export async function getAdmin(hre: HardhatRuntimeEnvironment) {
  return await getContractAt(hre, "TimelockController", "HexlinkAdmin");
}

export async function getFactory(hre: HardhatRuntimeEnvironment) {
  const deployed = await hre.deployments.get("HexlinkContractFactory");
  const { deployer } = await hre.ethers.getNamedSigners();
  return HexlinkContractFactory__factory.connect(deployed.address, deployer);
}

export async function getEntryPoint(hre: HardhatRuntimeEnvironment) {
  let entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  if (hre.network.name === 'hardhat') {
      const deployed = await hre.deployments.get("EntryPoint");
      entrypoint = deployed.address;
  }
  return getContractAt(hre, "EntryPoint", entrypoint);
}

export async function getContractAt(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  addressOrName?: string
) {
  let address;
  if (addressOrName === undefined) {
    const deployed = await hre.deployments.get(contract);
    address = deployed.address;
  } else if (!ethers.isAddress(addressOrName)) {
    const deployed = await hre.deployments.get(addressOrName);
    address = deployed.address;
  } else {
    address = addressOrName;
  }
  const artifact = await hre.artifacts.readArtifact(contract);
  return new ethers.Contract(address, artifact.abi);
}

export async function deterministicDeploy(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  salt: string,
  args?: string,
  data?: string
) : Promise<{address: string, deployed: boolean}> {
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args ?? "0x");
  const address = await factory.getAddress(bytecode, salt);
  if (await isContract(hre, address)) {
      console.log(`Reusing ${contract} deployed at ${address}`);
      return { deployed: false, address };
  } else {
      const tx = await factory.deployAndCall(bytecode, salt, data ?? "0x");
      await tx.wait();
      console.log(`deploying ${contract} (tx: ${tx.hash})...: deployed at ${address}`);
      return { deployed: true, address };
  }
}

export async function getDeterministicAddress(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  salt: string,
  args: string
) {
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args);
  return await factory.getAddress(bytecode, salt);
}

export async function isContract(
  hre: HardhatRuntimeEnvironment,
  address: string
) {
  try {
      const code = await hre.ethers.provider.getCode(address);
      if (code !== '0x') return true;
  } catch (error) { }
  return false;
}
