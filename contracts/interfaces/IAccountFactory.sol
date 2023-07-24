// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../interfaces/IERC4972Registry.sol";
import "./structs.sol";

interface IAccountFactory is IERC4972Registry {
    function getDefaultValidator(address nameService) external view returns(address);

    function getAccountImplementation(address nameService) external view returns(address);

    function deploy(address nameService, bytes32 name) external returns(address);
}