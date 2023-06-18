
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../utils/AuthFactorStruct.sol";
import "../utils/AuthProviderInfoStruct.sol";
import "../utils/Constants.sol";
import "./storage/AuthValidatorStorage.sol";
import "./storage/AuthFactorStorage.sol";
import "./auth/IAuthProvider.sol";

abstract contract AuthFactorManager {
    using ECDSA for bytes32;

    struct AuthInfo {
        AuthFactor factor;
        bytes signature;
    }

    struct AuthInput {
        AuthInfo first;
        AuthInfo second;
    }

    event FirstFactorUpdated(AuthFactor indexed);
    event SecondFactorUpdated(AuthFactor indexed);
    event SecondFactorRemoved(AuthFactor indexe);
    event SecondFactorDisabled();
    event SecondFactorEnabled();
    event ValidatorsAdded(bytes32 indexed key, address[] validators);
    event ValidatorsRemoved(bytes32 indexed key, address[] validators);

    function getAuthFactors()
        external
        view
        returns(AuthFactor[] memory factors)
    {
        return AuthFactorStorage.layout().factors;
    }

    function isSecondFactorEnabled() public view returns(bool) {
        return AuthFactorStorage.layout().enableSecond;
    }

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

    function _updateFirstFactor(AuthFactor memory factor) internal {
        require(factor.provider != address(0), "invalid auth provider");
        AuthFactorStorage.updateFirstFactor(factor);
        emit FirstFactorUpdated(factor);
    }

    function _addSecondFactor(AuthFactor memory factor) internal {
        require(factor.provider != address(0), "invalid auth provider");
        AuthFactorStorage.addSecondFactor(factor);
        emit SecondFactorUpdated(factor);
    }

    function _removeSecondFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.removeSecondFactor(factor);
        emit SecondFactorRemoved(factor);
    }

    function _enableSecondFactor() internal {
        require(
            AuthFactorStorage.layout().factors.length > 1,
            "no second factor set"
        );
        AuthFactorStorage.layout().enableSecond = true;
        emit SecondFactorEnabled();
    }

    function _disableSecondFactor() internal {
        AuthFactorStorage.layout().enableSecond = false;
        emit SecondFactorDisabled();
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

    function _validateAuthFactors(
        bytes32 userOpHash,
        bytes memory signature
    ) internal view returns(uint256 validationData) {
        AuthInput memory auth = abi.decode(signature, (AuthInput));
        // validate first factor
        require(
            AuthFactorStorage.isFirstFactor(auth.first.factor),
            "not valid first factor"
        );
        validationData = _validate(
            auth.first.factor,
            userOpHash,
            auth.first.signature
        );
        // validate second factor
        if (validationData == 0 && isSecondFactorEnabled()) {
            require(
                AuthFactorStorage.isSecondFactor(auth.second.factor),
                "not valid first factor"
            );
            validationData = _validate(
                auth.second.factor,
                userOpHash,
                auth.second.signature
            );
        }
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