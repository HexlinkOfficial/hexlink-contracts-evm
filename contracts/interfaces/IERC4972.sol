// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IERC4972 {
    function getOwnedAccount(
        bytes32 nameType,
        bytes32 name
    ) external view returns (address);
}

interface IERC4972Account {
    function getNameType() external view returns (bytes32);

    function getName() external view returns (bytes32);

    function getNameRegistry() external view returns (address);
}