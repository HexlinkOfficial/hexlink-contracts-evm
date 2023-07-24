// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/Account.sol";

contract AccountV2ForTest is Account {
    constructor(
        address entryPoint,
        address erc4972Registry,
        address nameService,
        address validatorMetadataRegistry
    ) Account(
        entryPoint,
        erc4972Registry,
        nameService,
        validatorMetadataRegistry
    ) { }

    function name() external pure returns (string memory) {
        return "AccountV2ForTest";
    }
}