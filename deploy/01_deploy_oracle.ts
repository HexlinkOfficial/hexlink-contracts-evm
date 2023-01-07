import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import { ethers, Contract } from "ethers";
import config from '../config.json';

function netConf(hre: HardhatRuntimeEnvironment) {
    return config[hre.network.name as keyof typeof config] || {};
}

async function createOracle(
  name: string,
  hre: HardhatRuntimeEnvironment
): Promise<string> {
  const oracleImpl = await hre.deployments.get("SimpleIdentityOracle");
  const { deployer } = await hre.ethers.getNamedSigners();
  const oracle = await hre.ethers.getContractAt("SimpleIdentityOracle", oracleImpl.address);
  const tx = await oracle.connect(deployer).clone(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name + new Date().toISOString()))
  );
  const receipt = await tx.wait();
  const events = receipt.logs.filter(
    (log: any) => log.address == oracle.address
  ).map(
    (log: any) => oracle.interface.parseLog(log)
  );
  const event = events.find((e: any) => e.name == "Cloned");
  const deployed = event.args.cloned;
  return deployed;
}

async function initOracle(
  deployed: string,
  admin: string,
  hre: HardhatRuntimeEnvironment
) {
    // register validator
    const oracle = await hre.ethers.getContractAt("SimpleIdentityOracle", deployed);
    const owner = await oracle.owner();
    if (owner.toLowerCase() == ethers.constants.AddressZero.toLowerCase()) {
      const { deployer } = await hre.ethers.getNamedSigners();
      let validator = netConf(hre)["validator"];
      if (validator == undefined) {
          validator = (await hre.getNamedAccounts())["validator"];
      }
      console.log("Registering valdiator " + validator + " at oracle " + deployed);
      await oracle.connect(deployer).init(admin, [validator], [true]);
    }
}

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("SimpleIdentityOracle", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true
  });

  const oracles = netConf(hre)["oracles"] || {};
  let emailOtp = oracles["EMAIL_OTP"];
  if (emailOtp == undefined) {
    emailOtp = await createOracle("EMAIL_OTP", hre);
  } else {
    console.log("reusing EMAIL_OTP oracle at " + emailOtp);
  }

  let twitterOAuth = oracles["TWITTER_OAUTH"];
  if (twitterOAuth == undefined) {
    twitterOAuth = await createOracle("TWITTER_OAUTH", hre);
  } else {
    console.log("reusing TWITTER_OAUTH oracle at " + twitterOAuth);
  }

  const admin = await hre.deployments.get("HexlinkAdmin");
  await initOracle(emailOtp, admin.address, hre);
  await initOracle(twitterOAuth, admin.address, hre);

  await deploy("IdentityOracleRegistry", {
    from: deployer,
    args: [
      admin.address, [
          {identityType: 1, authType: 1}, // email otp 
          {identityType: 4, authType: 2}, // twitter oauth
      ], [emailOtp, twitterOAuth]],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ["HEXL", "ORACLE"];
