// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "../../../utils/Constants.sol";
import "./IStaticAuthProvider.sol";

contract DAuthAuthProvider is IStaticAuthProvider, Constants, Ownable {
    address private immutable _validator;
    address private _nextProvider;
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

    function getProviderType() external pure returns(uint8) {
        return 0;
    }

    function getValidator() public view override returns(address) {
        return _validator;
    }

    function getNextProvider() public view override returns(address) {
        return _nextProvider;
    }

    function setNextProvider(address next) external onlyOwner {
        IStaticAuthProvider provider = IStaticAuthProvider(next);
        require(provider.getProviderType() == 0, "invalid provider type");
        address validator = provider.getValidator();
        require(_registry.isValidatorRegistered(validator), "invalid next validator");
        _nextProvider = next;
    }
}
