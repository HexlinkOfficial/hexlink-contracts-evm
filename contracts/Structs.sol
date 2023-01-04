//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.8;

/*
 * The request id is a hash over the request, contract processing
 * the request and chainId. The signature is signed over keccak256
 * hash of AuthProofToSign struct
 */
struct AuthProof{
    uint256 issuedAt;
    uint256 identityType;
    uint256 authType;
    bytes signature; // aggregated signature
}

struct RedPacket {
    address token;
    uint64 expiredAt; // 0 means never expire
    uint32 split;
    uint256 balance;
    address creator;
    address validator;
    uint8 mode; // 0: not_set, 1: fixed, 2: randomized
    bool enableGasStation;
}