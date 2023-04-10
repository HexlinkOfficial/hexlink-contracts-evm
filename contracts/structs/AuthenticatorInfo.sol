//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

struct AuthenticatorInfo {
    // a list of service URIs to relay message from dApps to authenticators
    string[] relayURI;
    // a JSON string or URI pointing to a JSON file describing the
    // schema of AuthenticationRequest. The URI should follow ERC-4804
    // if the schema file is stored on-chain
    string schema;
}