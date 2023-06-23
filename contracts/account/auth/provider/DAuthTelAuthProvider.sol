// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./DAuthAuthProvider.sol";

contract DAuthTelAuthProvider is DAuthAuthProvider {
    bytes32 constant TEL = keccak256('tel');

    constructor(address validator) DAuthAuthProvider(validator) { }

    function getNameType() external pure override returns(bytes32) {
        return TEL;
    }
}