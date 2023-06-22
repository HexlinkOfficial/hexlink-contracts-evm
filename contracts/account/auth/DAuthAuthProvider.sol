// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IAuthProvider.sol";

interface IDAuthRegistry {
    function isValidatorRegistered(address validator) external view returns(bool);

    function getDefaultValidator() external view returns(address);

    // get one random validator other than the default one
    function getOneValidator() external view returns(address);
}

abstract contract DAuthAuthProvider is IAuthProvider {
    IDAuthRegistry immutable registry;

    constructor(address dauthRegistry) {
        registry = IDAuthRegistry(dauthRegistry);
    }

    function getDefaultValidator() public view override returns(address) {
        return registry.getDefaultValidator();
    }

    function checkValidator(
        bytes32 /* name */,
        address signer
    ) external view override returns(uint256) {
        if (signer == getDefaultValidator()) {
            return 0;
        } else if (registry.isValidatorRegistered(signer)) {
            return 1;
        } else {
            return 2;
        }
    }
}