// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

contract EnsAuthProvider is IAuthProvider {
    bytes32 constant ENS = keccak256('ens');

    function getKey() external pure override returns(bytes32) {
        // keccak256('hexlink.account.auth.provider.ens');
        return 0x7d09ba11344100c97442ec3c4a4116e0008183bebb4b5428f3b58acd62cb7de8;
    }

    function isSupported(bytes32 nameType) external pure returns(bool) {
        return nameType == ENS
    }

    function getDefaultValidator() external pure override returns(address) {
        return address(0);
    }
}