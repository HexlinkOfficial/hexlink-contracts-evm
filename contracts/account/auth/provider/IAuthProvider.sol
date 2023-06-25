// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function validateSignature(
        bytes32 name,
        bytes32 nameType,
        bytes32 message,
        address signer,
        bytes calldata signature
    ) external view returns(uint256);

    function isValidSigner(
        bytes32 name,
        bytes32 nameType,
        address signer
    ) external view returns(bool);

    function isSupportedNameType(
        bytes32 nameType
    ) external view returns(bool);
}