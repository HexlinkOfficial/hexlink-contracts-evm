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

    function getValidator(
        bytes32 nameType,
        bytes32 name
    ) external view returns(address);
}