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
| ContractFactory | 0xa6524A512A808B8D716aB4f142B71F6B15F1deE9 |
| AccountProxy | 0x9f81B7588A4Bd2b0e5893f12666c6475a63022ae |
| HexlinkProxy | 0x9f81B7588A4Bd2b0e5893f12666c6475a63022ae |

To ensure all derived accounts share same addresses across different chains, we need to fix the addresses of ContractFactory , HexlinkProxy and AccountProxy. HexlinkProxy and AccountProxy share the same proxy implementation as "HexlinkERC1967Proxy". The contract factory is deployed with 0x170c915f302B07BBe406F918F3053C242f70DdA4.

## Prod

TBD
