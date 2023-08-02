// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

interface IServiceRegistry {
    function stake(uint256 amount) external; 

    function unstake(uint256 amount) external;

    function openSubscription() external;

    function closeSubscription() external;

    function getToken() external view returns(address);
}