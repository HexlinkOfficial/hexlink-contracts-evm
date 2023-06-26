// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

interface IStaticAuthProvider is IAuthProvider {
    function getValidator() external view returns(address);

    function getSuccessor() external view returns(address);
}