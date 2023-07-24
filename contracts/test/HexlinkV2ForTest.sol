// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../Hexlink.sol";

contract HexlinkV2ForTest is Hexlink {
    function name() external pure returns (string memory) {
        return "HexlinkV2ForTest";
    }
}
