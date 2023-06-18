
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./storage/AuthProviderStorage.sol";
import "./storage/AuthFactorStorage.sol";
import "../utils/Constants.sol";
import "./auth/IAuthProvider.sol";

abstract contract AuthProviderManager is Constants {
    using ECDSA for bytes32;

    event ValidatorsAdded(bytes32 indexed key, address[] validators);
    event ValidatorsRemoved(bytes32 indexed key, address[] validators);

    struct AuthProviderInfo {
        address provider;
        bytes32 key;
        address defaultValidator;
    }

    address immutable dAuthAuthProvider;

    constructor(address dAuthAuthProvider_) {
        dAuthAuthProvider = dAuthAuthProvider_;
    }

    function getAuthProvider(bytes32 nameType) public view returns(address) {
        address authProvider = AuthProviderStorage.getAuthProvider(nameType);
        if ((nameType == MAILTO || nameType == TEL) && authProvider == address(0)) {
            return dAuthAuthProvider;
        }
        return authProvider;
    }

    function getAuthProviderInfo(
        bytes32 nameType
    ) public view returns(AuthProviderInfo memory info) {
        info.provider = getAuthProvider(nameType);
        IAuthProvider authProvider = IAuthProvider(info.provider);
        info.key = authProvider.getKey();
        info.defaultValidator = authProvider.getDefaultValidator();
    }

    function isValidatorEnabled(
        bytes32 key,
        address validator
    ) public view returns(bool) {
        return AuthProviderStorage.validators(key)[validator];
    }

    function _setAuthProvier(bytes32 nameType, address provider) internal {
        bool supported = IAuthProvider(provider).isSupported(nameType);
        require(supported, "name type not supported");
        AuthProviderStorage.setAuthProvider(nameType, provider);
    }

    function _addValidators(
        bytes32 key,
        address[] memory validators
    ) internal {
        AuthProviderStorage.addValidators(key, validators);
        emit ValidatorsAdded(key, validators);
    }

    function _removeValidators(
        bytes32 provider,
        address[] memory validators
    ) internal {
        AuthProviderStorage.removeValidators(provider, validators);
        emit ValidatorsRemoved(provider, validators);
    }

    function _validate(
        AuthFactor memory factor,
        bytes32 message,
        bytes memory signature
    ) internal view returns(uint256) {
        AuthProviderInfo memory info = getAuthProviderInfo(factor.nameType);
        bytes32 signed = keccak256(abi.encode(factor.nameType, factor.name, message));
        address signer = signed.toEthSignedMessageHash().recover(signature);
        if (info.defaultValidator != address(0) && signer == info.defaultValidator) {
            return 0;
        }
        return isValidatorEnabled(info.key, signer) ? 0 : 1;
    }
}