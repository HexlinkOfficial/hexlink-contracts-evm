// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";
import "../../utils/Constants.sol";

abstract contract DAuthAuthProvider is IAuthProvider, Constants {
    address public immutable _defaultValidator;

    constructor(address defaultValidator_) {
        _defaultValidator = defaultValidator_;
    }

    function getDefaultValidator() external view override returns(address) {
        return _defaultValidator;
    }

    function isSupported(bytes32 nameType) external pure returns(bool) {
        return nameType == MAILTO || nameType == TEL;
    }

    function getKey() external pure override returns(bytes32) {
        // keccak256('hexlink.account.auth.provider.dauth');
        return 0x80f61525d15cb1c26df9752b352b3530d4e400ebf5893d90ef306ac5410e9b42;
    }
}