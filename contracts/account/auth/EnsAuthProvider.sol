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

    function isDefaultValidator(address) external pure override returns(bool) {
        return false;
    }

    function checkValidator(
        bytes32 name,
        address validator
    ) external view override returns(bool) {
        return getValidator(name) == validator;
    }

    // return validator given name
    function getValidator(
        bytes32 name
    ) public view override returns(address) {
        return ens.owner(name);
    }
}