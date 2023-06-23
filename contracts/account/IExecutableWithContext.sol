//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "./structs.sol";

interface IExecutableWithContext {
    function exec(
        UserRequest memory request,
        RequestContext calldata ctx
    ) external payable;

    function execBatch(
        UserRequest[] memory requests,
        RequestContext[] calldata ctxes
    ) external payable;
}