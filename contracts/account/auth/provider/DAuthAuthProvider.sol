// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "../../../interfaces/IAuthProvider.sol";

contract DAuthAuthProvider is IAuthProvider, Ownable {
    event ValidatorUpdated(address indexed validator);
    event MetadataUpdated(bytes32 metadata);

    address private _validator;
    string private _metadata;
    IValidatorRegistry private immutable _registry;

    constructor(address owner, address validator, address registry, string memory metadata) {
        _transferOwnership(owner);
        _registry = IValidatorRegistry(registry);
       _setValidator(validator);
       _metadata = metadata;
    }

    function getRegistry() external view returns(address) {
        return address(_registry);
    }

    function getValidator(address /*account*/) external view override returns(address) {
        return getDefaultValidator();
    }

    function getDefaultValidator() public view returns(address) {
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

    function setMetadata(string memory metadata) internal {
        _metadata = metadata;
        emit MetadataUpdated(keccak256(bytes(metadata)));
    }

    function getMetadata() external view override returns(string memory) {
        return _metadata;
    }
}
