// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IERC4972.sol";
import "./structs.sol";

interface IAccountFactory is IERC4972 {
    function getAuthProvider(bytes32 nameType) external view returns(address);

    function getAccountImplementation() external view returns(address);

    function deploy(bytes32 nameType, bytes32 name) external returns(address);
}