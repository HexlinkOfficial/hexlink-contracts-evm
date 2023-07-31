// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface INameService {
    function isOwner(
        bytes32 name,
        address owner
    ) external view returns(bool);
}