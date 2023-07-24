// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IERC4972Registry {
    function getOwnedAccount(
        address nameService,
        bytes32 name
    ) external view returns (address);
}