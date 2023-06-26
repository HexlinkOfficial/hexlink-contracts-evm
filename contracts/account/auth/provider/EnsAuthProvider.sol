// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import "./IDynamicAuthProvider.sol";
import "../../../utils/Constants.sol";

contract EnsAuthProvider is IDynamicAuthProvider, Constants {
    ENS immutable ens;

    constructor(address ens_) {
        ens = ENS(ens_);
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType == ENS_NAME;
    }

    function isValidSigner(
        bytes32 nameType,
        bytes32 name,
        address signer
    ) public view override returns(bool) {
        return isSupportedNameType(nameType) && ens.owner(name) == signer;
    }

    function getProviderType() external pure returns(uint8) {
        return 1;
    }
}