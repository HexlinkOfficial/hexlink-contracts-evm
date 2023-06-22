// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function getNameType() external view returns(bytes32);

    function getDefaultValidator() external view returns(address);

    /**
        if it's default validator, return 0
        if it's not default validator but valid, return 1
        if it's not a valid, return 2
     */
    function checkValidator(
        bytes32 name,
        address signer
    ) external view returns(uint256);
}