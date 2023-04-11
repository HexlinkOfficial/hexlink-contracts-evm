import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

import * as config from '../config.json';
const getSafe = async function(hre: HardhatRuntimeEnvironment) {
    let netConf = config[hre.network.name as keyof typeof config] || {};
    if ((netConf as any)["safe"] !== undefined) {
        return hre.ethers.utils.getAddress((netConf as any)["safe"]);
    } else {
        const { deployer } = await hre.getNamedAccounts();
        return deployer;
    }
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("HexlinkSwapImpl", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  try {
    await deployments.get("HexlinkSwapProxy");
    console.log(
      "HexlinkSwap is already deployed, please " + 
      "upgrade instead of deploying a new one"
    );
    return;
  } catch {
    const impl = await hre.deployments.get("HexlinkSwapImpl");
    const implContract = await hre.ethers.getContractAt(
        "HexlinkSwapImpl",
        impl.address
    );
    const admin = await getSafe(hre);
    const initData = implContract.interface.encodeFunctionData(
        "init", [admin]
    );
    await deploy("HexlinkSwapProxy", {
      from: deployer,
      args: [impl.address, initData],
      log: true,
      autoMine: true,
    });
  }
}

export default func;
func.tags = ["APP"];
func.id = "swap";