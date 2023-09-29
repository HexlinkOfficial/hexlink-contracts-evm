import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

import "./tasks/admin";
import "./tasks/hexlink";

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

const accounts = process.env.HARDHAT_DEPLOYER && process.env.HARDHAT_FACTORY_DEPLOYER ?
  [process.env.HARDHAT_DEPLOYER, process.env.HARDHAT_FACTORY_DEPLOYER] :
  [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  ];
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.12",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  networks: {
    goerli: {
      chainId: 5,
      url: process.env.HARDHAT_GOERLI_URL || "",
      accounts,
    },
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${process.env.VITE_INFURA_API_KEY}`,
      accounts,
    },
    naut: {
      chainId: 22222,
      url: "https://api.nautilus.nautchain.xyz",
      accounts,
    },
    naut_test: {
      chainId: 88002,
      url: "https://api.proteus.nautchain.xyz/solana",
      accounts,
    },
    bsc: {
      chainId: 56,
      url: "https://bsc-dataseed1.binance.org/",
      accounts,
    },
    bsc_test: {
      chainId: 97,
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
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
    arbitrum: {
      chainId: 42161,
      url: "https://arb1.arbitrum.io/rpc",
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
    factoryDeployer: {
      default: 1,
    },
    validator: {
      default: 2,
    },
    tester: {
      default: 3,
    },
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY!,
      sepolia: process.env.ETHERSCAN_API_KEY!,
      mumbai: process.env.POLYSCAN_API_KEY!,
    },
    customChains: [
      {
        network: "goerli",
        chainId: 5,
        urls: {
          apiURL: "https://api-goerli.etherscan.io/api",
          browserURL: "https://goerli.etherscan.io"
        }
      },
      {
        network: "mumbai",
        chainId: 80001,
        urls: {
          apiURL: "https://api-testnet.polygonscan.com/api",
          browserURL: "https://mumbai.polygonscan.com/"
        }
      },
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io"
        }
      }
    ]
  },
  paths: {
    deploy: "deploy",
    deployments: "deployments",
  },
};

export default config;
