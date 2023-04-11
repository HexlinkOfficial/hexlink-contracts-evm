// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../structs/Name.sol";

interface IAccountFactory {
    function accountImplementation() external view returns(address);

    function deploy(
        Name calldata name,
        address owner,
        bytes calldata proof
    ) external returns(address);
}