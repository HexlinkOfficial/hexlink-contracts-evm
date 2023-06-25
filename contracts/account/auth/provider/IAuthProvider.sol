// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function isValidSigner(
        bytes32 nameType,
        bytes32 name,
        address signer
    ) external view returns(bool);

    function isSupportedNameType(
        bytes32 nameType
    ) external view returns(bool);
}