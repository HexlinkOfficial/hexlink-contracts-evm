
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../utils/Constants.sol";
import "./storage/AuthFactorStorage.sol";
import "./auth/IAuthProvider.sol";

abstract contract AuthFactorManager {
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct AuthInput {
        AuthFactor factor;
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

    function _updateFirstFactor(AuthFactor memory factor) internal {
        require(address(factor.provider) != address(0), "invalid auth provider");
        AuthFactorStorage.updateFirstFactor(factor);
        emit FirstFactorUpdated(factor);
    }

    function _addSecondFactor(AuthFactor memory factor) internal {
        require(address(factor.provider) != address(0), "invalid auth provider");
        AuthFactorStorage.addSecondFactor(factor);
        emit SecondFactorUpdated(factor);
    }

    function _removeSecondFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.removeSecondFactor(factor);
        emit SecondFactorRemoved(factor);
    }

    /** validation logic */

    modifier onlyValidSigner() {
        AuthContext memory ctx1 = AuthFactorStorage.layout().contexts.first;
        uint256 status = setValidator(ctx1.signer, ctx1.index);
        require(status < 4, "invalid signer");
        if (status <= 2 && isSecondFactorEnabled()) {
            AuthContext memory ctx2 = AuthFactorStorage.layout().contexts.second;
            status = setValidator(ctx2.signer, ctx2.index);
            require(status < 4, "invalid signer");
            if (status <= 2) {
                _;
            }
        }
    }

    function setValidator(address validator, uint96 index) public returns(uint256) {
        AuthFactor storage factor = AuthFactorStorage.getAuthFactor(index);
        IAuthProvider provider = factor.provider;
        if (provider.isDefaultValidator(validator)) {
            return 0; // signer valid and is default;
        }
        bytes32 name = factor.name;
        bool isValid = provider.checkValidator(name, validator);
        bool isCached = isCachedValdiator(address(provider), validator);
        if (isValid) {
            if (isCached) {
                return 1; // signer valid and cached
            } else {
                _cacheValidator(address(provider), validator);
                return 2; // signer valid but not cached
            }
        } else {
            address toCache = provider.getValidator(name);
            _cacheValidator(address(provider), toCache);
            if (isCached) {
                _removeValidator(address(provider), validator);
                return 3; // signer not valid but cached
            } else {
                return 4; // signer not valid and not cached
            }
        }
    }

    function isCachedValdiator(
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
    ) internal returns(uint256) {
        AuthInput[] memory auth = abi.decode(signature, (AuthInput[]));
        // validate first factor
        require(
            AuthFactorStorage.getAuthFactorIndex(auth[0].factor) == 1,
            "first factor not found"
        );
        (uint validationData1, address signer1) = _validate(
            auth[0].factor,
            userOpHash,
            auth[0].signature
        );
        AuthFactorStorage.layout().contexts.first = AuthContext(signer1, 0);
        // validate second factor
        if (validationData1 == 0 && isSecondFactorEnabled()) {
            uint256 factorIndex =
                AuthFactorStorage.getAuthFactorIndex(auth[1].factor);
            require(factorIndex > 1, "second factor not found");
            (uint validationData2, address signer2) = _validate(
                auth[1].factor,
                userOpHash,
                auth[1].signature
            );
            AuthFactorStorage.layout().contexts.second =
                AuthContext(signer2, uint96(factorIndex));
            return validationData2;
        } else {
            return validationData1;
        }
    }

    function _validate(
        AuthFactor memory factor,
        bytes32 message,
        bytes memory signature
    ) internal view returns(uint256, address) {
        bytes32 nameType = factor.provider.getNameType();
        bytes32 signed = keccak256(abi.encode(nameType, factor.name, message));
        address signer = signed.toEthSignedMessageHash().recover(signature);

        if (factor.provider.isDefaultValidator(signer)) {
            return (0, signer);
        }
        uint256 numOfCachedValidators =
            AuthFactorStorage.layout().cachedValidators[address(factor.provider)].length();
        return numOfCachedValidators == 0 || isCachedValdiator(address(factor.provider), signer)
            ? (0, signer)
            : (1, signer);
    }
}