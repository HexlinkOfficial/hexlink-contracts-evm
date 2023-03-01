import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("HexlinkTokenFactoryImpl", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  let factory;
  try {
    factory = await hre.run("token_factory", {});
    console.log("reusing HexlinkTokenFactory at " + factory.address);
    console.log("HexlinkTokenFactory is already deployed, please upgrade instead of deploying a new one");
  } catch {
    console.log("HexlinkTokenFactory is not deployed, will deploy...");
    const factoryImpl = await deployments.get("HexlinkTokenFactoryImpl");
    const factoryDeployment = await deploy("HexlinkTokenFactory", {
      from: deployer,
      args: [factoryImpl.address, []],
      log: true,
      autoMine: true,
    });
    factory = await hre.ethers.getContractAt(
      "HexlinkTokenFactoryImpl",
      factoryDeployment.address
    );
  }

  const admin = await hre.deployments.get("HexlinkAdmin");
  if ((await factory.owner()) !== admin.address) {
    console.log("initiating token factory...");
    const erc721Impl = await deployments.get("HexlinkErc721Proxy");
    await factory.init(admin.address, erc721Impl.address);
  }

  await deploy("HexlinkToken", {
    from: deployer,
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ["HEXL", "TOKEN"];
