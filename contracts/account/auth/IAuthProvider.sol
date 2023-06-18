// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function isSupported(bytes32 nameType) external view returns(bool);

    function getKey() external view returns(bytes32);

    function getDefaultValidator() external view returns(address);
}