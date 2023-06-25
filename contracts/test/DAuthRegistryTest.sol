// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/auth/provider/DAuthAuthProvider.sol";

contract DAuthRegistryTest is IDAuthRegistry {
    address internal immutable _validator;

    constructor(address validator) {
        _validator = validator;
    }

    function getValidator() external view returns(address) {
        return _validator;
    }

    function isValidatorRegistered(address validator) external view returns(bool) {
        return _validator == validator;
    }
}