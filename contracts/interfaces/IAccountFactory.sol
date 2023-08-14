// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAccountFactory {
    function getAccountImplementation() external view returns(address);

    function deploy(bytes32 name) external returns(address);
}