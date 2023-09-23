// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface INamespaceRegistry {
    event NewOwner(bytes32 indexed ns, address owner);

    event NewRegistry(bytes32 indexed ns, address registry);

    function getOwner(bytes32 ns) external view returns(address);

    function getRegistry(bytes32 ns) external view returns(address);

    function setNamespace(bytes32 ns, address owner, address registry) external;

    function setOwner(bytes32 ns, address owner) external;

    function setRegistry(bytes32 ns, address registry) external;
}
