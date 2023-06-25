// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import "./AuthProviderBase.sol";

contract EnsAuthProvider is AuthProviderBase {
    ENS immutable ens;

    constructor(address ens_) {
        ens = ENS(ens_);
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType == ENS_NAME;
    }

    function isValidSigner(
        bytes32 /* nameType */,
        bytes32 name,
        address signer
    ) public view override returns(bool) {
        return ens.owner(name) == signer;
    }
}