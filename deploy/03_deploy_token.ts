import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("HexlinkNft", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  await deploy("HexlinkToken", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  await deploy("TestHexlinkERC1155", {
    from: deployer,
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ["TEST"];
