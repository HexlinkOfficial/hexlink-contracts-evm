
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthFactor {
    address provider;
    address validator;
}

struct AuthInput {
    address signer;
    bytes signature;
}

struct RiskAssertion {
    uint256 score;
    uint256 validUtil;
    address signer;
    bytes signature;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}