// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/HexlinkAccount.sol";

contract HexlinkAccountV2ForTest is HexlinkAccount {
    constructor(
        address entryPoint,
        address hexlink
    ) HexlinkAccount(entryPoint, hexlink) { }

    function name() external pure returns (string memory) {
        return "AccountV2ForTest";
    }
}