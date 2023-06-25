// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./AuthProviderBase.sol";

interface IDAuthRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);
}

contract DAuthAuthProvider is AuthProviderBase {
    IDAuthRegistry public immutable registry;

    constructor(address dauthRegistry) {
        registry = IDAuthRegistry(dauthRegistry);
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType == MAILTO || nameType == TEL;
    }

    function isValidSigner(
        bytes32 nameType,
        bytes32 /* name */,
        address signer
    ) public view override returns(bool) {
        return isSupportedNameType(nameType)
            && registry.isValidatorRegistered(signer);
    }
}