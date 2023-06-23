// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IRiskEngine.sol";

contract SimpleRiskEngine is IRiskEngine {
    function assess(
        UserRequest calldata /* request */,
        bytes32 /* requestHash */,
        RiskAssertion calldata /* risk */
    ) external pure override returns(bool) {
        // always require step up
        return true;
    }
}