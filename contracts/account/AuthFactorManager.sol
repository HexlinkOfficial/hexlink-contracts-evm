
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "../utils/Constants.sol";
import "./storage/AuthFactorStorage.sol";
import "./auth/IAuthProvider.sol";
import "./AccountModuleBase.sol";

abstract contract AuthFactorManager is AccountModuleBase {
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;

    error InvalidSigner();

    struct AuthInput {
        AuthFactor factor;
        address signer;
        bytes signature;
    }

    event FirstFactorUpdated(AuthFactor indexed);
    event SecondFactorUpdated(AuthFactor indexed);
    event SecondFactorRemoved(AuthFactor indexe);
    event SecondFactorDisabled();
    event SecondFactorEnabled();
    event ValidatorAdded(address indexed provider, address validator);
    event ValidatorRemoved(address indexed provider, address validator);

    function getAuthFactors() external view returns(AuthFactor[] memory factors) {
        return AuthFactorStorage.layout().factors;
    }

    function isSecondFactorEnabled() public view returns(bool) {
        return AuthFactorStorage.layout().factors.length > 1;
    }

    function updateFirstFactor(AuthFactor memory factor) onlySelf external {
        _updateFirstFactor(factor);
    }

    function _updateFirstFactor(AuthFactor memory factor) internal {
        require(address(factor.provider) != address(0), "invalid auth provider");
        AuthFactorStorage.updateFirstFactor(factor);
        emit FirstFactorUpdated(factor);
    }

    function addSecondFactor(AuthFactor memory factor) onlySelf external {
        require(address(factor.provider) != address(0), "invalid auth provider");
        AuthFactorStorage.addSecondFactor(factor);
        emit SecondFactorUpdated(factor);
    }

    function removeSecondFactor(AuthFactor memory factor) onlySelf external {
        AuthFactorStorage.removeSecondFactor(factor);
        emit SecondFactorRemoved(factor);
    }

    /** validation logic */

    modifier onlyValidSigner() {
        AuthContext memory ctx1 = AuthFactorStorage.layout().contexts.first;
        uint256 status = setValidator(ctx1.signer, ctx1.index);
        if (status <= 2 && isSecondFactorEnabled()) {
            AuthContext memory ctx2 = AuthFactorStorage.layout().contexts.second;
            status = setValidator(ctx2.signer, ctx2.index);
            if (status <= 2) {
                _;
            }
        }
    }

    function setValidator(address signer, uint96 index) public returns(uint256) {
        AuthFactor memory factor = AuthFactorStorage.getAuthFactor(index);
        uint256 validationData = factor.provider.checkValidator(factor.name, signer);
        if (validationData == 0) {
            return 0; // signer valid and is default;
        }
        address provider = address(factor.provider);
        bool isCached = isCachedValidator(provider, signer);
        if (validationData == 1) {
            if (isCached) {
                return 1; // signer valid and cached
            } else {
                _cacheValidator(provider, signer);
                return 2; // signer valid but not cached
            }
        } else {
            if (isCached) {
                _removeValidator(provider, signer);
                return 3; // signer not valid but cached
            } else {
                revert InvalidSigner(); // signer not valid and not cached
            }
        }
    }

    function isCachedValidator(
        address provider,
        address validator
    ) public view returns(bool) {
        return AuthFactorStorage.layout().cachedValidators[
            provider
        ].contains(validator);
    }

    function getAllCachedValidators(
        address provider
    ) external view returns(address[] memory) {
        return AuthFactorStorage.layout().cachedValidators[provider].values();
    }

    function _cacheValidator(
        address provider,
        address validator
    ) internal {
        AuthFactorStorage.layout().cachedValidators[provider].add(validator);
        emit ValidatorAdded(provider, validator);
    }

    function _removeValidator(
        address provider,
        address validator
    ) internal {
        AuthFactorStorage.layout().cachedValidators[provider].remove(validator);
        emit ValidatorRemoved(provider, validator);
    }

    function _validateAuthFactors(
        bytes32 userOpHash,
        bytes memory signature
    ) internal returns(uint256 validationData) {
        AuthInput[] memory auth = abi.decode(signature, (AuthInput[]));
        uint256 expectedNumOfAuthInput = isSecondFactorEnabled() ? 2 : 1;
        require(
            auth.length == expectedNumOfAuthInput,
            "invalid auth input length"
        );

        // validate first factor
        require(
            AuthFactorStorage.getAuthFactorIndex(auth[0].factor) == 1,
            "first factor not found"
        );
        validationData = _validateAuthInput(
            auth[0],
            userOpHash
        );
        if (validationData == 0) {
            AuthFactorStorage.layout().contexts.first
                = AuthContext(auth[0].signer, 0);
        }

        // validate second factor
        if (validationData == 0 && expectedNumOfAuthInput == 2) {
            require(auth.length == 2, "invalid auth input");
            uint256 factorIndex =
                AuthFactorStorage.getAuthFactorIndex(auth[1].factor);
            require(factorIndex > 1, "second factor not found");
            validationData = _validateAuthInput(
                auth[1],
                userOpHash
            );
            if (validationData == 0) {
                AuthFactorStorage.layout().contexts.second =
                    AuthContext(auth[1].signer, uint96(factorIndex));
            }
        }
    }

    function _validateAuthInput(
        AuthInput memory auth,
        bytes32 message
    ) internal view returns(uint256) {
        AuthFactor memory factor = auth.factor;
        bytes32 nameType = factor.provider.getNameType();
        bytes32 toSign = keccak256(abi.encode(nameType, auth.factor.name, message));

        address defaultValidator = factor.provider.getDefaultValidator();
        address provider = address(factor.provider);
        if (defaultValidator != address(0)) {
            if (defaultValidator == auth.signer) {
                return auth.signer.isValidSignatureNow(toSign, auth.signature) ? 0 : 1;
            } else {
                uint256 numOfCachedValidators =
                    AuthFactorStorage.layout().cachedValidators[provider].length();
                if (numOfCachedValidators == 0) {
                    return auth.signer.isValidSignatureNow(toSign, auth.signature) ? 0 : 1;
                }
            }
        }
        if (isCachedValidator(provider, auth.signer)) {
            return auth.signer.isValidSignatureNow(toSign, auth.signature) ? 0 : 1;
        } else {
            return 1;
        }
    }
}
