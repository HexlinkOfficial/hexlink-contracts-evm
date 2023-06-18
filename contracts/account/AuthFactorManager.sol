
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./storage/AuthFactorStorage.sol";
import "./AuthProviderManager.sol";

abstract contract AuthFactorManager is AuthProviderManager {
    using Address for address;
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

    function _updateFirstFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.updateFirstFactor(factor);
        emit FirstFactorUpdated(factor);
    }

    function _addSecondFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.addSecondFactor(factor);
        emit SecondFactorUpdated(factor);
    }

    function _removeSecondFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.removeSecondFactor(factor);
        emit SecondFactorRemoved(factor);
    }

    function _enableSecondFactor() internal {
        AuthFactorStorage.layout().enableSecond = true;
        emit SecondFactorEnabled();
    }

    function _disableSecondFactor() internal {
        AuthFactorStorage.layout().enableSecond = false;
        emit SecondFactorDisabled();
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
        if (validationData == 0 && AuthFactorStorage.layout().enableSecond) {
            require(
                AuthFactorStorage.isSecondFactor(auth.second.factor),
                "not valid first factor"
            );
            validationData = _validate(
                auth.first.factor,
                userOpHash,
                auth.second.signature
            );
        }
    }
}