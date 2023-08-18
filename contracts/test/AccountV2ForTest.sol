// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/Account.sol";

contract AccountV2ForTest is Account {
    constructor(
        address entryPoint,
        address erc4972Registry
    ) Account(entryPoint, erc4972Registry) { }

    function name() external pure returns (string memory) {
        return "AccountV2ForTest";
    }

    function version() public pure override returns (uint256) {
        return Account.version() + 1;
    }
}