//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

interface INameValidator {
    function validate(
        bytes32 name,
        bytes32 message,
        bytes memory signature
    ) external view returns(uint256);
}