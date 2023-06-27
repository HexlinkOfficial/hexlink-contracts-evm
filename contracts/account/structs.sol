
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthProvider {
    address provider;
    uint8 providerType;
}

struct AuthValidator {
    address signer;
    bool isCurrent;
}

struct AuthFactor {
    bytes32 nameType;
    bytes32 name;
    AuthProvider provider;
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