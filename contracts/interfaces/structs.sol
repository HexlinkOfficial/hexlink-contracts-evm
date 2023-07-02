
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthFactor {
    address provider;
    address validator;
}

struct AuthInput {
    uint256 validationData;
    address signer;
    bytes signature;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}