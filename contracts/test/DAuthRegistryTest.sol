// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/interfaces/IAuthProvider.sol";

contract DAuthRegistryTest is IValidatorRegistry {
    mapping(address => bool) internal _validators;

    constructor(address[] memory validators) {
        for (uint i = 0; i < validators.length; i++) {
            _validators[validators[i]] = true;
        }
    }

    function isValidatorRegistered(address validator) external view returns(bool) {
        return _validators[validator];
    }
}