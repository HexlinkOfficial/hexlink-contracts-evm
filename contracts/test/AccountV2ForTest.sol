// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/Account.sol";

contract AccountV2ForTest is Account {
    constructor(address entrypoint) Account(entrypoint) { }

    function name() external pure returns (string memory) {
        return "AccountV2ForTest";
    }
}