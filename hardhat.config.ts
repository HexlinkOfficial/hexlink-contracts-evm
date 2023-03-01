import { HardhatUserConfig, task, extendEnvironment } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

import "./tasks/admin";
import "./tasks/account";
import "./tasks/nft";
import "./tasks/hexlink";
import "./tasks/auth";
import "./tasks/app";
import "./tasks/redpacket";

task("abi", "Prints abi of contract")
    .addParam("contract", "contract name")
    .addFlag("print", "print abi")
    .setAction(async (args, {artifacts}) => {
      const artifact = await artifacts.readArtifact(args.contract);
      if (args.print) {
        console.log(JSON.stringify(artifact.abi, null, 2));
      }
      return artifact.abi;
    });

task("accounts", "Prints the list of accounts", async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

const accounts = process.env.HARDHAT_DEPLOYER !== undefined ?
  [process.env.HARDHAT_DEPLOYER] :
  [];
const config: HardhatUserConfig = {
  solidity: "0.8.8",
  networks: {
    goerli: {
      chainId: 5,
      url: process.env.HARDHAT_GOERLI_URL || "",
      accounts,
    },
    mumbai: {
      chainId: 80001,
      url: process.env.HARDHAT_MUMBAI_URL || "",
      accounts,
    },
    galileo: {
      chainId: 3334,
      url: "https://galileo.web3q.io:8545",
      accounts,
    },
    nova: {
      chainId: 42170,
      url: "https://nova.arbitrum.io/rpc",
      accounts,
    },
    nitro: {
      chainId: 421613,
      url: "https://goerli-rollup.arbitrum.io/rpc",
      accounts,
    }
  },
  gasReporter: {
    enabled: false,
    currency: "USD",
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    validator: {
      default: 1,
    },
    tester: {
      default: 2,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    deploy: "deploy",
    deployments: "deployments",
  },
};

export default config;
