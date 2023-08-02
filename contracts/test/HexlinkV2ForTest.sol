// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../hexlink/Hexlink.sol";

contract HexlinkV2ForTest is Hexlink {
    constructor(
        address erc1967Proxy,
        address nameService,
        address authRegistry
    ) Hexlink(erc1967Proxy, nameService, authRegistry) { }

    function name() external pure returns (string memory) {
        return "HexlinkV2ForTest";
    }
}
