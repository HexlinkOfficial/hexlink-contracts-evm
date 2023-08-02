// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface INameService {
    function defaultOwner() external view returns(address);

    function owner(bytes32 name) external view returns(address);
}