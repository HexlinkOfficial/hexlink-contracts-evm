// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function getNameType() external view returns(bytes32);

    function isRegistered(
        bytes32 name,
        address signer
    ) external view returns(bool);
}