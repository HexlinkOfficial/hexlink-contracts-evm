// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IERC4972AccountInitializer {
    function initialize(bytes32 name, address owner) external;
}