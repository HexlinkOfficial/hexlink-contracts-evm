
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthFactor {
    address provider;
    address validator;
}

struct AuthInput {
    address signer;
    address aggregator;
    uint48 validUntil;
    uint48 validAfter;
    bytes signature;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}