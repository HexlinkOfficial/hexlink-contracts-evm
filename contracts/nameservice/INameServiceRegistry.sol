// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface INameServiceRegistry is IERC165 {
    function resolverOf(bytes32 node) external view returns(address);

    function ownerOf(bytes32 node) external view returns(address);
}
