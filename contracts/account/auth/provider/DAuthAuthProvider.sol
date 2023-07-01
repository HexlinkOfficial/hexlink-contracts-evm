// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "../../../interfaces/IAuthProvider.sol";

contract DAuthAuthProvider is IAuthProvider, Ownable {
    event ValidatorUpdated(address indexed validator);

    address private _validator;
    IValidatorRegistry private immutable _registry;

    constructor(address owner, address validator, address registry) {
        _transferOwnership(owner);
        _registry = IValidatorRegistry(registry);
       _setValidator(validator);
    }

    function getRegistry() external view returns(address) {
        return address(_registry);
    }

    function getValidator(address /*account*/) external view override returns(address) {
        return _validator;
    }

    function setValidator(address validator) external onlyOwner {
        _setValidator(validator);
        emit ValidatorUpdated(validator);
    }

    function _setValidator(address validator) internal {
        require(_registry.isValidatorRegistered(validator), "invalid validator");
        _validator = validator;
    }
}
