// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

interface IDAuthRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);

    function getDefaultValidator() external view returns(address);

    // get one validator other than the default one
    function getOneValidator() external view returns(address);
}

abstract contract DAuthAuthProvider is IAuthProvider {
    IDAuthRegistry immutable registry;
    address public immutable _defaultValidator;

    constructor(address dauthRegistry) {
        registry = IDAuthRegistry(dauthRegistry);
        _defaultValidator = registry.getDefaultValidator();
    }

    function isDefaultValidator(address validator) external view override returns(bool) {
        return _defaultValidator == validator;
    }

    function checkValidator(
        bytes32 /* name */,
        address validator
    ) external view override returns(bool) {
        return registry.isValidatorRegistered(validator);
    }

    function getValidator(
        bytes32 /* name */
    ) external view override returns(address) {
        return registry.getOneValidator();
    }
}