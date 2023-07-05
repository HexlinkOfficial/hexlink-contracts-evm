import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, Contract } from "ethers";
import * as config from '../config.json';

export function hash(value: string) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

export async function getDeployedContract(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  name?: string
) : Promise<Contract> {
  const deployed = await hre.deployments.get(name || contract);
  return hre.ethers.getContractAt(contract, deployed.address); 
}

export function nameHash(name: {schema: string, domain: string, handle: string}) : string {
    return ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "bytes32", "bytes32"],
          [name.schema, name.domain, name.handle]
        )
    );
}

export function loadConfig(hre: HardhatRuntimeEnvironment, key: string) : any {
  let netConf = config[hre.network.name as keyof typeof config] || {};
  return (netConf as any)[key];
}

export async function getAdmin(hre: HardhatRuntimeEnvironment) {
  return getDeployedContract(hre, "TimelockController", "HexlinkAdmin");
}

export async function getFactory(hre: HardhatRuntimeEnvironment) {
  const factoryDeployed = await hre.deployments.get("HexlinkContractFactory");
  return await hre.ethers.getContractAt(
      "HexlinkContractFactory",
      factoryDeployed.address
  );
}

export function getBytecode(artifact: Artifact, args: string | []) {
  return ethers.utils.solidityPack(
      ["bytes", "bytes"],
      [artifact.bytecode, args]
  );
}

export async function getEntryPoint(hre: HardhatRuntimeEnvironment) {
    let entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    if (hre.network.name === 'hardhat') {
        const deployed = await hre.deployments.get("EntryPoint");
        entrypoint = deployed.address;
    }
    return hre.ethers.getContractAt("EntryPoint", entrypoint);
}

export async function getDAuthRegistry(hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === 'hardhat') {
      const deployed = await hre.deployments.get("DAuthRegistryTest");
      return hre.ethers.getContractAt("IValidatorRegistry", deployed.address);
  } else {
    throw new Error("not supported");
  }
}

export async function getHexlink(hre: HardhatRuntimeEnvironment) {
    const factory = await getFactory(hre);
    const bytecode = getBytecode(
        await hre.artifacts.readArtifact("HexlinkERC1967Proxy"), []
    );
    const salt = hash("hexlink.HexlinkERC1967Proxy");
    const hexlink = await factory.getAddress(bytecode, salt);
    return hre.ethers.getContractAt("Hexlink", hexlink);
}

export async function searchContract(contract: String, hre : HardhatRuntimeEnvironment) {
  if (contract === 'AuthModule') {
      const module = await hre.deployments.get("AuthModule")
      return module.address;
  } else if (contract === 'Hexlink') {
      const hexlink = await getHexlink(hre);
      return hexlink.address;
  } else {
      throw new Error(`contract ${contract} not found`)
  }
}

export async function getValidator(hre: HardhatRuntimeEnvironment) {
  let validator = loadConfig(hre, "validator");
  if (hre.network.name == "hardhat" || validator == undefined) {
      return (await hre.getNamedAccounts())["validator"];
  }
  return validator;
}
