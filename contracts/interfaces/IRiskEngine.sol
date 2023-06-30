// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./structs.sol";

interface IRiskEngine {
    function assess(
        bytes32 requestHash,
        RiskAssertion calldata assertion
    ) external returns(bool);
}