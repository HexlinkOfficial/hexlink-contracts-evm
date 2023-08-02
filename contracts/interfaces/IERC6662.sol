// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthRegistry.sol";

interface IERC6662 {
    function getAuthRegistry() external view returns (IAuthRegistry);
}
