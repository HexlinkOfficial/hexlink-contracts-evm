// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IERC4972.sol";
import "./IAccountFactory.sol";

interface IHexlink is IERC4972, IAccountFactory {
    function init(address owner, address[] memory registries) external;
}