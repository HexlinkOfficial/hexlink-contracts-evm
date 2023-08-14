// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAccountInitializer {
    function initialize(bytes32 name, address owner) external;
}