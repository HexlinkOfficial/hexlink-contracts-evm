
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "./storage/AuthFactorStorage.sol";
import "./AuthValidatorManager.sol";

abstract contract AuthFactorManager is AuthValidatorManager {
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
}