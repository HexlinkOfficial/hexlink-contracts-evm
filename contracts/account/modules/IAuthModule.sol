// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthModule {
    function validate(
        bytes32 message,
        bytes memory signature
    ) external view returns(uint256);
}