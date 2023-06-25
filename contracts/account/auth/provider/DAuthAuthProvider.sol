// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./AuthProviderBase.sol";

interface IDAuthRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);

    // get one random validator other than the default one
    function getOneValidator() external view returns(address);
}

abstract contract DAuthAuthProvider is AuthProviderBase {
    IDAuthRegistry immutable registry;

    constructor(address dauthRegistry) {
        registry = IDAuthRegistry(dauthRegistry);
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType == MAILTO || nameType == TEL;
    }

    function isValidSigner(
        bytes32 /* nameType */,
        bytes32 /* name */,
        address signer
    ) public view override returns(bool) {
        return registry.isValidatorRegistered(signer);
    }
}