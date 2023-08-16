// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IVersionManager {
    function getLatestVersion() external view returns(uint256);

    function getImplementation(uint256 version) external view returns(address);

    function getImplementations(
        uint256 start,
        uint256 end
    ) external view returns(address[] memory);
}