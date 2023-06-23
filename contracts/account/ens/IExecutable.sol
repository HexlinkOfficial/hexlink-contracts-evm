//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../structs.sol";

interface IExecutable {
    function exec(UserRequest memory request) external payable;

    function execBatch(UserRequest[] memory requests) external payable;
}