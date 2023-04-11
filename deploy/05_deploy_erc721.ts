import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("HexlinkErc721Impl", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  try {
    await deployments.get("HexlinkErc721Proxy");
    console.log(
      "HexlinkErc721Proxy is already deployed, please " + 
      "upgrade instead of deploying a new one"
    );
    return;
  } catch {
    const impl = await hre.deployments.get("HexlinkErc721Impl");
    const admin = await hre.deployments.get("HexlinkAdmin");
    await deploy("HexlinkErc721Beacon", {
      from: deployer,
      args: [impl.address, admin.address],
      log: true,
      autoMine: true,
    });

    // deploy beacon proxy contract
    const beacon = await hre.deployments.get("HexlinkErc721Beacon");
    await deploy("HexlinkErc721Proxy", {
      from: deployer,
      args: [beacon.address],
      log: true,
      autoMine: true,
    });
  }

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
}

export default func;
func.tags = ["APP"];
func.id = "erc721";