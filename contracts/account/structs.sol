
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthFactor {
    bytes32 nameType;
    bytes32 name;
    address provider;
}

struct AuthInput {
    AuthFactor factor;
    address signer;
    bytes signature;
}

struct RiskAssertion {
    uint256 score;
    uint256 validUtil;
    address signer;
    bytes signature;
}

struct RequestContext {
    AuthInput auth;
    RiskAssertion risk;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}