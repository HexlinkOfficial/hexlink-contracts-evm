// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/INameService.sol";

contract DAuthNameService is INameService {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private validators_;

    constructor(address[] memory validators) {
        for (uint i = 0; i < validators.length; i++) {
            validators_.add(validators[i]);
        }
    }

    function getAllValidators() external view returns(address[] memory) {
        return validators_.values();
    }

    function isOwner(
        IERC4972Account /* account */,
        address owner
    ) external view returns(bool) {
        return validators_.contains(owner);
    }

    function isSupported(
        bytes32 nameType
    ) external pure returns(bool) {
        return nameType == keccak256('mailto') ||
            nameType == keccak256('tel');
    }
}