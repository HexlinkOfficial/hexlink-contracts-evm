
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthProvider {
    address provider;
    // 0: IAuthProvider
    // 1: EOA
    // 2: IERC1271
    uint8 providerType;
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