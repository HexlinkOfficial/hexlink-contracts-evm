//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../structs/AuthenticatorInfo.sol";

interface IExectuable {
    function exec(
        address dest,
        uint256 value,
        bytes calldata func
    ) external payable;

    function execBatch(
        address[] calldata dest,
        uint256[] calldata values,
        bytes[] calldata func
    ) external payable;
}