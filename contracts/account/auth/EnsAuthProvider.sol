// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";
import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';

contract EnsAuthProvider is IAuthProvider {
    bytes32 constant ENS_NAME_TYPE = keccak256('ens');

    ENS immutable ens;

    constructor(address ens_) {
        ens = ENS(ens_);
    }

    function getNameType() external pure override returns(bytes32) {
        return ENS_NAME_TYPE;
    }

    function getDefaultValidator() external pure override returns(address) {
        return address(0);
    }

    function checkValidator(
        bytes32 name,
        address signer
    ) external view override returns(uint256) {
        return ens.owner(name) == signer ? 1 : 2;
    }
}