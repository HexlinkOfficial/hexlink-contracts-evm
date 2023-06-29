// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IValidatorRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);
}

interface IAuthProvider {
    function getValidator(address account) external view returns(address);
}
