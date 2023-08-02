import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import * as config from '../config.json';

export function hash(value: string) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
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

export function getBytecode(artifact: Artifact, args: string | []) {
  return ethers.utils.solidityPack(
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

export async function getEntryPoint(hre: HardhatRuntimeEnvironment) {
  let entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  if (hre.network.name === 'hardhat') {
      const deployed = await hre.deployments.get("EntryPoint");
      entrypoint = deployed.address;
  }
  return hre.ethers.getContractAt("EntryPoint", entrypoint);
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

export async function getAdmin(hre: HardhatRuntimeEnvironment) {
  return getContract(hre, "TimelockController", "HexlinkAdmin");
}

export async function getFactory(hre: HardhatRuntimeEnvironment) {
  return getContract(hre, "HexlinkContractFactory");
}

export async function getContract(
  hre : HardhatRuntimeEnvironment,
  contract: string,
  name?: string
) {
  const deployed = await hre.deployments.get(name || contract);
  return await hre.ethers.getContractAt(contract, deployed.address);
}

export async function deterministicDeploy(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  salt: string,
  args?: string | [],
  data?: string | []
) : Promise<{address: string, deployed: boolean}> {
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args ?? []);
  const address = await factory.getAddress(bytecode, salt);
  if (await isContract(hre, address)) {
      console.log(`Reusing ${contract} deployed at ${address}`);
      return { deployed: false, address };
  } else {
      const tx = await factory.deployAndCall(bytecode, salt, data ?? []);
      await tx.wait();
      console.log(`deploying ${contract} (tx: ${tx.hash})...: deployed at ${address}`);
      return { deployed: true, address };
  }
}

export async function getDeterministicAddress(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  salt: string,
  args: string | []
) {
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args);
  return await factory.getAddress(bytecode, salt);
}

async function isContract(hre: HardhatRuntimeEnvironment, address: string) {
  try {
      const code = await hre.ethers.provider.getCode(address);
      if (code !== '0x') return true;
  } catch (error) { }
  return false;
}