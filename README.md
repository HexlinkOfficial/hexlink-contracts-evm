# Hexlink Contracts

This is the repo to hold all evm smart contracts for Hexlink, including:

1. The account contract implementation
2. The Hexlink name registry implementation
3. The Hexlink implementation

# Hexlink Contract Design

The design(outdated) could be found at:

1. [Hexlink Contract Design](https://docs.google.com/document/d/1rggtUx_oS0rD3e9hYCvAL0IslBUc7OaOQC9ily24X1A/edit?usp=sharing)
2. [Hexlink Account Contract Design](https://docs.google.com/document/d/1r2hulO2eJJokoH_gO9cdKQTyegUnTUCtSN-_M3E9hnw/edit?usp=sharing)

# Account Abstraction Dependency

The repo depends on ver0.6.0 of [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction/tree/ver0.6.0). You need to clone the repo to local and put it at the same folder of this repo and link the repo as the dependency of this one.

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
| ContractFactory | 0xcc2f69bebdd6c0429AaBe457b80A8Aa759250591 |
| Admin (Timelock) | 0x209cCd60F9B583A230Dc4048959a0024B63f0308|
| AccountBeacon | 0x9B329281Ad0c1DfE1DB44577C64A58001ca8Ea8C |
| AccountProxy | 0xCcB1B1521F020c4a07431983Ef09676B18935680 |
| Hexlink | 0xB85891B99d1F75A5c6F128d7cE0b7A6883782cbF |
| HexlinkProxy | 0x159b030C6f922Bca0fEfd2E675B1e648eB42C9b6 |

To ensure all derived accounts share same addresses across different chains, we need to fix the addresses of ContractFactory , HexlinkProxy, AccountProxy and AccountBeacon. The contract factory is deployed with 0x379585377405288F17eAB12AC96DeceF487F0Fa4, and all contracts are owned by 0x861F2f5ffB35F0a4C2832307161e2D46E263B775.

## Prod

TBD