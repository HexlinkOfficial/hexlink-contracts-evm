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

export async function getHexlink(hre: HardhatRuntimeEnvironment) {
  const salt = hash("hexlink.dev");
  return await getHexlinkImpl(hre, salt);
}

export async function getHexlinkDev(hre: HardhatRuntimeEnvironment) {
  const salt = hash("hexlink.prod");
  return await getHexlinkImpl(hre, salt);
}

async function getHexlinkImpl(hre: HardhatRuntimeEnvironment, salt: string) {
  const { deployer } = await hre.ethers.getNamedSigners();
  const factory = await getFactory(hre);
  const bytecode = getBytecode(
      await hre.artifacts.readArtifact("HexlinkERC1967Proxy"), '0x'
  );
  return new Contract(
    await factory.calculateAddress(bytecode, salt),
    await getAbi(hre, "Hexlink"),
    deployer
  );
}

export async function getAdmin(hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.ethers.getNamedSigners();
  const deployed = await hre.deployments.get("HexlinkAdmin");
  return new Contract(
    deployed.address,
    await getAbi(hre, "TimelockController"),
    deployer
  );
}

export async function getFactory(hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.ethers.getNamedSigners();
  const deployed = await hre.deployments.get("HexlinkContractFactory");
  return new Contract(
    deployed.address,
    await getAbi(hre, "HexlinkContractFactory"),
    deployer
  );
}

export async function deterministicDeploy(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  salt: string,
  args?: string,
  data?: string,
) : Promise<{address: string, deployed: boolean}> {
  const {deployer} = await hre.ethers.getNamedSigners();
  const factory = await getFactory(hre);
  const artifact = await hre.artifacts.readArtifact(contract);
  const bytecode = getBytecode(artifact, args ?? "0x");
  const address = await factory.calculateAddress(bytecode, salt);
  if (await isContract(hre, address)) {
      console.log(`Reusing ${contract} deployed at ${address}`);
      return { deployed: false, address };
  } else {
      const tx = await factory.connect(deployer).deployAndCall(
        bytecode, salt, data || "0x");
      await tx.wait();
      console.log(`deploying ${contract} (tx: ${tx.hash})...: deployed at ${address}`);
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
