// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IERC4972Account.sol";

interface IAuthRegistry {
    function getAuthMetadata(address validator) external view returns(string memory);
}