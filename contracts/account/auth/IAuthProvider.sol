// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IAuthProvider {
    function getNameType() external view returns(bytes32);

    function isDefaultValidator(address validator) external view returns(bool);

    function checkValidator(
        bytes32 name,
        address validator
    ) external view returns(bool);

    function getValidator(bytes32 name) external view returns(address);
}