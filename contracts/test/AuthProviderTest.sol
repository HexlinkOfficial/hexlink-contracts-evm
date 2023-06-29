// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../account/AuthFactorManager.sol";

contract AuthProviderTest {
    function testEncode(AuthProvider memory provider) public pure returns(bytes32) {
        return AuthProviderEncoder.encode(provider);
    }

    function testDecode(bytes32 provider) public pure returns(AuthProvider memory) {
        return AuthProviderEncoder.decode(provider);
    }
}