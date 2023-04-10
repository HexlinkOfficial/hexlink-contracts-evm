// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IERC4972Account {
    function getName() external view returns(bytes32, address);
}