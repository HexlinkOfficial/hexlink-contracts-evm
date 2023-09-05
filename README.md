# Hexlink Contracts

This is the repo to hold all evm smart contracts for Hexlink, including:

1. The account contract implementation
2. The Hexlink name registry implementation
3. The Hexlink implementation

# Hexlink Contract Design

The design(outdated) could be found at:

1. [Hexlink Contract Design](https://docs.google.com/document/d/1rggtUx_oS0rD3e9hYCvAL0IslBUc7OaOQC9ily24X1A/edit?usp=sharing)
2. [Hexlink Account Contract Design](https://docs.google.com/document/d/1r2hulO2eJJokoH_gO9cdKQTyegUnTUCtSN-_M3E9hnw/edit?usp=sharing)

# Commands

```shell
# clean and compile contracts
npx hardhat clean; npx hardhat compile

# run tests
npx hardhat test

# deploy to local
doppler run -- npx hardhat deploy --tags PROD

# deploy to goerli testnet
doppler run -- npx hardhat deploy --network goerli --tags PROD
```

# Etherscan verification

```shell
doppler run -- npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS $CONSTRUCTOR_PARAMS
```

# Deployed Contracts

## Development Env

| Contract | Address |
| ----------- | ----------- |
| ContractFactory | 0xF4CCB60BeAb96E801A2c3598e15b4d1Ed72ECa53 |
| AccountProxy | 0x4c552dC72756A690883f9e8955B231c43c4E598e |
| HexlinkProxy | 0x4c552dC72756A690883f9e8955B231c43c4E598e |

To ensure all derived accounts share same addresses across different chains, we need to fix the addresses of ContractFactory , HexlinkProxy and AccountProxy. HexlinkProxy and AccountProxy share the same proxy implementation as "HexlinkERC1967Proxy". The contract factory is deployed with 0x9Afa9fcf35E2486cF3E6775FC9eD93EA14de2926.

## Prod

TBD

# How to Deploy and Upgrade

## How to deploy Hexlink

```
# deploy contracts
doppler run -- npx hardhat deploy --network sepolia

# check deployed contract
doppler run -- npx hardhat hexlink_check --network sepolia

# stake token for hexlink contract since it
# has to access its storage during deployment
doppler run -- npx hardhat add_stake --network sepolia


```


## How to update Hexlink

1. deploy Hexlink
2. 