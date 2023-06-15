// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IERC4972 {
    function ownedAccount(
        bytes32 nameType,
        bytes32 name
    ) external view returns (address);
}