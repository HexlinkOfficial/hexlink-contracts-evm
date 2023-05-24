import { HardhatRuntimeEnvironment } from "hardhat/types";
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

export async function getHexlink(
  hre : HardhatRuntimeEnvironment,
  hexlink?: string
) : Promise<Contract> {
  return await hre.ethers.getContractAt(
      "Hexlink",
      hexlink || "0x4c552dC72756A690883f9e8955B231c43c4E598e"
  );
}

export async function getFactory(hre: HardhatRuntimeEnvironment) {
  const factoryDeployed = await hre.deployments.get("HexlinkContractFactory");
  return await hre.ethers.getContractAt(
      "HexlinkContractFactory",
      factoryDeployed.address
  );
}

export const buildAuthProof = async function (
    hre: HardhatRuntimeEnvironment,
    name: string,
    signer?: string,
    hexlink?: string,
) {
    const hexlinkContract = await getHexlink(hre, hexlink);
    const func = hexlinkContract.interface.getSighash("deploy")
    const validator = await hre.ethers.getNamedSigner(signer);
    const requestId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes4", "address", "uint256"],
        [
          func,
          hexlinkContract.address,
          hre.network.config.chainId,
        ]
      )
    );
    const message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32"],
        [name, requestId]
      )
    );
    return await validator.signMessage(
      ethers.utils.arrayify(message)
    );
  };