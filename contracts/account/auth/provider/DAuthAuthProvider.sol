// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "../../interfaces/IAuthProvider.sol";
import "../../../utils/Constants.sol";

contract DAuthAuthProvider is IAuthProvider, Constants, Ownable {
    address private _validator;
    IValidatorRegistry private immutable _registry;

    constructor(address owner, address validator, address registry) {
        _transferOwnership(owner);
        _validator = validator;
        _registry = IValidatorRegistry(registry);
    }

    function getRegistry() external view returns(address) {
        return address(_registry);
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType == MAILTO || nameType == TEL;
    }

    function getValidator(
        bytes32 nameType,
        bytes32 /* name */
    ) external view override returns(address) {
        return isSupportedNameType(nameType) ? _validator : address(0);
    }

    function setValidator(address validator) external onlyOwner {
        require(_registry.isValidatorRegistered(validator), "invalid validator");
        _validator = validator;
    }
}
