// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./DAuthAuthProvider.sol";

contract DAuthEmailAuthProvider is DAuthAuthProvider {
    bytes32 constant MAILTO = keccak256('mailto');

    constructor(address validator) DAuthAuthProvider(validator) { }

    function getNameType() external pure override returns(bytes32) {
        return MAILTO;
    }
}