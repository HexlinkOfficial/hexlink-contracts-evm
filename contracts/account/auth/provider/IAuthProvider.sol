// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IValidatorRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);
}

interface IAuthProvider {
    function isSupportedNameType(
        bytes32 nameType
    ) external view returns(bool);

    // 0: static auth provider
    // 1: dynamic auth provider
    function getProviderType() external view returns(uint8);
}