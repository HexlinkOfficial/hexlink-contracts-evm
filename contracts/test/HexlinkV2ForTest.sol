// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../hexlink/Hexlink.sol";

contract HexlinkV2ForTest is Hexlink {
    constructor(address erc1967Proxy) Hexlink(erc1967Proxy) { }

    function name() external pure returns (string memory) {
        return "HexlinkV2ForTest";
    }
}
