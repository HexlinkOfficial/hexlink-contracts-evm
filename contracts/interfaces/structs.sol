
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthFactor {
    address owner;
    bool initialized;
    bool isRegistryEnabled;
}

struct AuthInput {
    address signer;
    bytes signature;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}