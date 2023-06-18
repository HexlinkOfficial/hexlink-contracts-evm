// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function getNameType() external view returns(bytes32);

    function getKey() external view returns(bytes32);

    function getDefaultValidator() external view returns(address);
}