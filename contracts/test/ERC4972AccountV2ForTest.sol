// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/ERC4972Account.sol";

contract ERC4972AccountV2ForTest is ERC4972Account {
    constructor(
        address entryPoint,
        address erc4972Registry
    ) ERC4972Account(entryPoint, erc4972Registry) { }

    function name() external pure returns (string memory) {
        return "AccountV2ForTest";
    }

    function version() public pure override returns (uint256) {
        return ERC4972Account.version() + 1;
    }
}