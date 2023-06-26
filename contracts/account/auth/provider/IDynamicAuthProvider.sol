// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

interface IDynamicAuthProvider is IAuthProvider {
    function isValidSigner(
        bytes32 nameType,
        bytes32 name,
        address signer
    ) external view returns(bool);
}