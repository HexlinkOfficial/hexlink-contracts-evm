
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthFactor {
    address owner;
    bool initialized;
    bool isRegistryEnabled;
}

struct AuthInput {
    uint96 timeRange;
    bytes32 name; // optional
    address signer;
    bytes signature;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}