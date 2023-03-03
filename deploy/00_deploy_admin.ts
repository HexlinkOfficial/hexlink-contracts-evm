import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import * as config from '../config.json';
import { ethers } from "ethers";

const getAdminConfig = async function(hre: HardhatRuntimeEnvironment) {
    let netConf = config[hre.network.name as keyof typeof config] || {};
    const {deployer} = await hre.getNamedAccounts();
    const safe = (netConf as any)["safe"] || deployer;
    return {
        minDelay: Number((netConf as any)["timelock"]?.minDelay || 0),
        proposers: [ethers.utils.getAddress(safe)],
        executors: [ethers.utils.getAddress(safe)]
    }
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  try {
    const admin = await hre.deployments.get("HexlinkAdmin");
    console.log("reusing HexlinkAdmin at " + admin.address);
  } catch(error) {
    const { minDelay, proposers, executors } = await getAdminConfig(hre);
    await deploy("HexlinkAdmin", {
      from: deployer,
      args: [minDelay, proposers, executors],
      log: true,
      autoMine: true
    });
  }
};

export default func;
func.tags = ["HEXL", "ADMIN"];
