import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("HappyRedPacketImpl", {
    from: deployer,
    log: true,
    autoMine: true
  });

  try {
    const proxy = await hre.run("redpacket", {});
    console.log("reusing HappyRedPacket at " + proxy.address);
    console.log("HappyRedPacket proxy is already deployed, please upgrade instead of deploying a new one");
  } catch {
    console.log("HappyRedPacket is not deployed, will deploy...");
    const impl = await deployments.get("HappyRedPacketImpl");
    const admin = await hre.deployments.get("HexlinkAdmin");
    const implContract = await hre.ethers.getContractAt(
      "HappyRedPacketImpl",
      impl.address
    );
    const initData = implContract.interface.encodeFunctionData(
      "initOwner", [admin.address]
    );
    await deploy("HappyRedPacket", {
      from: deployer,
      args: [impl.address, initData],
      log: true,
      autoMine: true,
    });
  }
};

export default func;
func.tags = ["APP"];
func.id = "redpacket";
