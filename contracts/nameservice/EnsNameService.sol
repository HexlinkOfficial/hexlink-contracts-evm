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
        IERC4972Account account,
        address owner
    ) external view returns(bool) {
        return ens.owner(account.getName()) == owner;
    }

    function isSupported(bytes32 nameType) external view returns(bool) {
        return nameType == bytes32(uint256(uint160(address(ens))));
    }
}