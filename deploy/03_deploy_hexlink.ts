import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  // deploy hexlink impl
  const accountProxy = await deployments.get("AccountProxy");
  await deploy("HexlinkUpgradeable", {
    from: deployer,
    args: [accountProxy.address],
    log: true,
    autoMine: true,
  });

  // deploy hexlink proxy
  try {
    const proxy = await hre.run("hexlink", {});
    console.log("reusing Hexlink at " + proxy.address);
    console.log("Hexlink is already deployed, please upgrade instead of deploying a new one");
  } catch {
    console.log("Hexlink is not deployed, will deploy...");
    const hexlinkImpl = await deployments.get("HexlinkUpgradeable");
    const hexlinkDeployment = await deploy("Hexlink", {
      from: deployer,
      args: [hexlinkImpl.address, []],
      log: true,
      autoMine: true,
    });

    const hexlink = await hre.ethers.getContractAt(
      "HexlinkUpgradeable",
      hexlinkDeployment.address
    );
    const admin = await hre.deployments.get("HexlinkAdmin");
    const oracleRegistry = await deployments.get(
      "IdentityOracleRegistry"
    );
    await hexlink.init(admin.address, oracleRegistry.address);
  }
};

export default func;
func.tags = ["HEXL", "CORE"];
