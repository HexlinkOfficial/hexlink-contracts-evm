// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import "../interfaces/INameService.sol";

contract EnsNameService is INameService {
    ENS immutable ens;

    constructor(address ens_) {
        ens = ENS(ens_);
    }

    function defaultOwner() external pure override returns(address) {
        return address(0);
    }

    function owner(bytes32 name) external view override returns(address) {
        return ens.owner(name);
    }
}