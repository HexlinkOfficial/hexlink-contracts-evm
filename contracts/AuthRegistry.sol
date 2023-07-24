// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

contract AuthRegistry {
    mapping(address => string) private metadata_;

    event AuthRegistered(
        address indexed account,
        bytes32 indexed metadata
    );

    function setMetadata(string memory metadata) external {
        metadata_[msg.sender] = metadata;
        emit AuthRegistered(
            msg.sender,
            keccak256(abi.encodePacked(metadata))
        );
    }

    function getMetadata() external view returns(string memory) {
        return metadata_[msg.sender];
    }
}