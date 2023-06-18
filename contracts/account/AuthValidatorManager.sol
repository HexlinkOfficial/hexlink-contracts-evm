
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./storage/AuthValidatorStorage.sol";
import "../utils/Constants.sol";
import "./auth/IAuthProvider.sol";
import "../utils/AuthFactorStruct.sol";
import "../utils/AuthProviderInfoStruct.sol";

abstract contract AuthValidatorManager is Constants {
    using ECDSA for bytes32;

    event ValidatorsAdded(bytes32 indexed key, address[] validators);
    event ValidatorsRemoved(bytes32 indexed key, address[] validators);

    function getAuthProviderInfo(
        address provider
    ) public view returns(AuthProviderInfo memory info) {
        IAuthProvider authProvider = IAuthProvider(provider);
        info.nameType = authProvider.getNameType();
        info.key = authProvider.getKey();
        info.defaultValidator = authProvider.getDefaultValidator();
    }

    function isValidatorEnabled(
        bytes32 key,
        address validator
    ) public view returns(bool) {
        return AuthValidatorStorage.contains(key, validator);
    }

    function getValidators(
        bytes32 key
    ) external view returns(address[] memory) {
        return AuthValidatorStorage.getAll(key);
    }

    function _addValidators(
        bytes32 key,
        address[] memory validators
    ) internal {
        AuthValidatorStorage.add(key, validators);
        emit ValidatorsAdded(key, validators);
    }

    function _removeValidators(
        bytes32 provider,
        address[] memory validators
    ) internal {
        AuthValidatorStorage.remove(provider, validators);
        emit ValidatorsRemoved(provider, validators);
    }

    function _validate(
        AuthFactor memory factor,
        bytes32 message,
        bytes memory signature
    ) internal view returns(uint256) {
        AuthProviderInfo memory info = getAuthProviderInfo(factor.provider);
        bytes32 signed = keccak256(abi.encode(info.nameType, factor.name, message));
        address signer = signed.toEthSignedMessageHash().recover(signature);
        if (info.defaultValidator != address(0) && signer == info.defaultValidator) {
            return 0;
        }
        return isValidatorEnabled(info.key, signer) ? 0 : 1;
    }
}