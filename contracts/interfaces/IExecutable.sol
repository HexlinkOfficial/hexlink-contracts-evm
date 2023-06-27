//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "./structs.sol";

interface IExecutable {
    function execute(UserRequest memory request) external payable;

    function executeBatch(UserRequest[] memory requests) external payable;
}
