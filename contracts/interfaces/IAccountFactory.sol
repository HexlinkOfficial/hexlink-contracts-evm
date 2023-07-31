// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./structs.sol";

interface IAccountFactory {
    function getDefaultValidator() external view returns(address);

    function getAccountImplementation() external view returns(address);

    function deploy(bytes32 name) external returns(address);
}