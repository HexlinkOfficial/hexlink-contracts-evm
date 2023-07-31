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

    function isOwner(
        bytes32 name,
        address owner
    ) external view returns(bool) {
        return ens.owner(name) == owner;
    }
}