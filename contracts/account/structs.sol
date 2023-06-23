
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

// name should be bytes(0) if provider is a simple EOA
struct AuthFactor {
    bytes32 name;
    address provider;
    // 1: EOA check
    // 2: IERC1271 check
    // 3: IAuthProvider check
    uint8 providerType;
}

struct AuthInput {
    AuthFactor factor;
    address signer;
    bytes signature;
}

struct RiskAssertion {
    bool pass;
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