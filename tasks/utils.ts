import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import * as config from '../config.json';
import { Contract } from "ethers";
import { getDeterministicDeployer } from "./deployer";

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

export async function getValidator(hre: HardhatRuntimeEnvironment, name: string) {
  if (hre.network.name === 'hardhat') {
    return (await hre.getNamedAccounts())["validator"];
  }
  return loadConfig(hre, name);
}

export async function getEntryPoint(hre: HardhatRuntimeEnvironment) {
  let entrypoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    entrypoint,
    await getAbi(hre, "EntryPoint"),
    deployer
  );
}

export async function getAirdrop(hre: HardhatRuntimeEnvironment, signer?: any) {
  let airdrop = loadConfig(hre, "airdrop");
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    airdrop,
    await getAbi(hre, "Airdrop"),
    signer ?? deployer
  );
}

export async function getAirdropPaymaster(
  hre: HardhatRuntimeEnvironment,
  dev: boolean = false
) {
  let paymaster = loadConfig(hre, dev ? "airdropPaymasterDev" : "airdropPaymaster");
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    paymaster,
    await getAbi(hre, "AirdropPaymaster"),
    deployer
  );
}

export async function getHexlink(hre: HardhatRuntimeEnvironment, dev: boolean = false) {
  let hexlink = loadConfig(hre, dev ? "hexlinkDev" : "hexlink");
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    hexlink,
    await getAbi(hre, "Hexlink"),
    deployer
  );
}

export async function getAdmin(hre: HardhatRuntimeEnvironment) {
  let admin = loadConfig(hre, "admin");
  const { deployer } = await hre.ethers.getNamedSigners();
  return new Contract(
    admin,
    await getAbi(hre, "TimelockController"),
    deployer
  );
}

export async function deterministicDeploy(
  hre: HardhatRuntimeEnvironment,
  contract: string,
  bytecode: string,
  salt: string
) : Promise<{address: string, deployed: boolean}> {
  const address = ethers.getCreate2Address(
    getDeterministicDeployer(),
    salt,
    ethers.keccak256(ethers.getBytes(bytecode))
  );
  if (await isContract(hre, address)) {
      console.log(`Reusing ${contract} deployed at ${address}`);
      return { deployed: false, address };
  } else {
    const {deployer} = await hre.ethers.getNamedSigners();
    const data = ethers.solidityPacked(["bytes32", "bytes"], [salt, bytecode]);
    const tx = await deployer.sendTransaction({ to: "0x4e59b44847b379578588920ca78fbf26c0b4956c", data});
    await tx.wait();
    console.log(`deploying ${contract} (tx: ${tx.hash})...: deployed at ${address}`);
    return { deployed: true, address };
  }
}

export async function isContract(hre: HardhatRuntimeEnvironment, address: string) {
  try {
      const code = await hre.ethers.provider.getCode(address);
      if (code !== '0x') return true;
  } catch (error) { }
  return false;
}
