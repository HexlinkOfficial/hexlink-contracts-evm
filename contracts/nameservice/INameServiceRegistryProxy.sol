// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./INameServiceRegistry.sol";

interface INameServiceRegistryProxy is INameServiceRegistry {
    error CrossChainLookup(string w3url);

    function getChainId() external view returns(uint256);

    function getRegistry() external view returns(address);
}
