//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../structs/Name.sol";

interface INameRegistry {
    function validateName(
        bytes32 name,
        bytes32 requestInfo,
        bytes memory proof
    ) external view returns(uint256);

    function getSchema() external view returns(bytes32);

    function getDomain() external view returns(bytes32);
}