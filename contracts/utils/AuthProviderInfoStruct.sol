//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;
    
struct AuthProviderInfo {
    bytes32 nameType;
    bytes32 key;
    address defaultValidator;
}