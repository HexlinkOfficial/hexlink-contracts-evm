// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IERC6662Account {
    function getAuthRegistry() external view returns (address);
}
