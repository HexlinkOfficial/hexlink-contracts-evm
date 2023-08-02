// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthRegistry.sol";
import "./INameService.sol";

interface IERC4972Registry {
    function getNameService() external view returns (INameService);

    function getOwnedAccount(bytes32 name) external view returns (address);
}