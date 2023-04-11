# Hexlink Contracts

This is the repo to hold all evm smart contracts for Hexlink, including:

1. The wallet contract implementation
2. The identity oracle implementation
3. The Hexlink name service implementation
4. The Hexlink auth implementation

# Hexlink Contract Design

The design could be found at:

1. [Hexlink Contract Design](https://docs.google.com/document/d/1rggtUx_oS0rD3e9hYCvAL0IslBUc7OaOQC9ily24X1A/edit?usp=sharing)
2. [Hexlink Wallet Contract Design](https://docs.google.com/document/d/1r2hulO2eJJokoH_gO9cdKQTyegUnTUCtSN-_M3E9hnw/edit?usp=sharing)

# Account Abstraction Dependency

The repo depends on ver0.6.0 of [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction/tree/ver0.6.0). You need to clone the repo to local and put it at the same folder of this repo and link the repo as the dependency of this one.

# Commands

```shell
# compile contracts
npx hardhat compile

# clean cache
npx hardhat clean

# run tests
npx hardhat test

# get metadata of deployed contracts
npx hardhat metadata

# deploy to local
doppler run -- npx hardhat deploy

# deploy to goerli testnet
doppler run -- npx hardhat deploy --network goerli
```

# Etherscan verification

```shell
doppler run -- npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS $CONSTRUCTOR_PARAMS
```

# Error Code Map

Check the map [here](https://docs.google.com/spreadsheets/d/1-7L5A0c2slNonNL85h6HEMTrVbWVo7VBsJSn9LEUHxg/edit?usp=sharing)
