// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

interface IDAuthRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);

    // get one random validator other than the default one
    function getOneValidator() external view returns(address);
}

abstract contract DAuthAuthProvider is IAuthProvider {
    IDAuthRegistry immutable registry;

    constructor(address dauthRegistry) {
        registry = IDAuthRegistry(dauthRegistry);
    }

    function isRegistered(
        bytes32 /* name */,
        address signer
    ) external view override returns(bool) {
        return registry.isValidatorRegistered(signer);
    }
}