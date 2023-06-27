// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import "../../../interfaces/IAuthProvider.sol";
import "../../../utils/Constants.sol";

contract EnsAuthProvider is IAuthProvider, Constants {
    ENS immutable ens;

    constructor(address ens_) {
        ens = ENS(ens_);
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType == ENS_NAME;
    }

    function getValidator(
        bytes32 nameType,
        bytes32 name
    ) public view override returns(address) {
        return isSupportedNameType(nameType) ? ens.owner(name) : address(0);
    }
}