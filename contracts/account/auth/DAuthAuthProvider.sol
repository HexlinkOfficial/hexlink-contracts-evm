// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

abstract contract DAuthAuthProvider is IAuthProvider {
    address public immutable _defaultValidator;

    constructor(address defaultValidator_) {
        _defaultValidator = defaultValidator_;
    }

    function getDefaultValidator() external view override returns(address) {
        return _defaultValidator;
    }

    function getKey() external pure override returns(bytes32) {
        // keccak256('hexlink.account.auth.provider.dauth');
        return 0x80f61525d15cb1c26df9752b352b3530d4e400ebf5893d90ef306ac5410e9b42;
    }
}