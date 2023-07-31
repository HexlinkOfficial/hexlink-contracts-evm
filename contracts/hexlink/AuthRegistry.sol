// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../interfaces/IAuthRegistry.sol";

contract AuthRegistry is IAuthRegistry {
    mapping(address => string) metadatas;

    event MetadataUpdated(
        address indexed validator,
        bytes32 indexed hash
    );

    function getAuthMetadata(
        address owner
    ) external view override returns(string memory) {
        return metadatas[owner];
    }

    function setAuthMetadata(string memory metadata) external {
        metadatas[msg.sender] = metadata;
        emit MetadataUpdated(msg.sender, keccak256(bytes(metadata)));
    }
}