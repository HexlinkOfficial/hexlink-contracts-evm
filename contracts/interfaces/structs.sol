
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
    AuthProvider provider;
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
    AuthFactor auth;
    RiskAssertion risk;
}

struct UserRequest {
    address target;
    uint256 value;
    bytes data;
}