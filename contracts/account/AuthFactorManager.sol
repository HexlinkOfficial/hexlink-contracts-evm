
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../utils/Constants.sol";
import "./auth/provider/IAuthProvider.sol";
import "./AccountModuleBase.sol";
import "./structs.sol";

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor');
 
    struct Layout {
        AuthFactor[] factors;
        mapping(bytes32 => uint256) indexes;
        EnumerableSet.AddressSet cachedValidators;
        address currentSigner;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function _encode(AuthFactor memory factor) private pure returns(bytes32) {
        return keccak256(abi.encode(factor.name, factor.provider, factor.providerType));
    }

    function getAuthFactor(uint96 index) internal view returns(AuthFactor storage) {
        require(index < layout().factors.length, "index out of bound");
        return layout().factors[index + 1];
    }

    function getAuthFactorIndex(AuthFactor memory factor) internal view returns(uint256) {
        return layout().indexes[_encode(factor)] - 1;
    }

    function updateFirstFactor(AuthFactor memory factor) internal {
        AuthFactor[] storage factors = layout().factors;
        mapping(bytes32 => uint256) storage indexes = layout().indexes;
        if (factors.length == 0) {
            factors.push(factor);
            indexes[_encode(factor)] = 1;
        } else {
            AuthFactor memory old = factors[0];
            delete indexes[_encode(old)];
            factors[0] = factor;
            indexes[_encode(factor)] = 1;
        }
    }

    function addSecondFactor(AuthFactor memory factor) internal {
        require(AuthFactorStorage.getAuthFactorIndex(factor) == 0, "already added");
        layout().factors.push(factor);
        layout().indexes[_encode(factor)] = layout().factors.length;
    }

    function removeSecondFactor(AuthFactor memory factor) internal {
        AuthFactor[] storage factors = layout().factors;
        mapping(bytes32 => uint256) storage indexes = layout().indexes;
        bytes32 key = _encode(factor);
        uint256 valueIndex = indexes[key];
        require(valueIndex > 1, "factor not found");
        uint256 toDeleteIndex = valueIndex - 1;
        uint256 lastIndex = factors.length - 1;
        if (lastIndex != toDeleteIndex) {
            AuthFactor memory lastValue = factors[lastIndex];
            factors[toDeleteIndex] = lastValue;
            indexes[_encode(lastValue)] = valueIndex;
        }
        factors.pop();
        delete indexes[key];
    }
}

abstract contract AuthFactorManager is AccountModuleBase {
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;

    event FirstFactorUpdated(AuthFactor indexed);
    event SecondFactorUpdated(AuthFactor indexed);
    event SecondFactorRemoved(AuthFactor indexeD);
    event SecondFactorDisabled(address indexed target);
    event SecondFactorEnabled(address indexed target);
    event CachedValidatorAdded(address validator);
    event CachedValidatorRemoved(address validator);

    function getAuthFactors() external view returns(AuthFactor[] memory factors) {
        return AuthFactorStorage.layout().factors;
    }

    function updateFirstFactor(AuthFactor memory factor) onlySelf external {
        _updateFirstFactor(factor);
    }

    function addSecondFactor(AuthFactor memory factor) onlySelf external {
        require(factor.provider.code.length > 0, "invalid auth provider");
        AuthFactorStorage.addSecondFactor(factor);
        emit SecondFactorUpdated(factor);
    }

    function removeSecondFactor(AuthFactor memory factor) onlySelf external {
        AuthFactorStorage.removeSecondFactor(factor);
        emit SecondFactorRemoved(factor);
    }

    function _updateFirstFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.updateFirstFactor(factor);
        emit FirstFactorUpdated(factor);
    }

    function _isSecondFactorEnabled() internal view returns(bool) {
        return AuthFactorStorage.layout().factors.length > 2;
    }

    /** validation logic */

    modifier onlyValidSigner() {
        address currentSigner = AuthFactorStorage.layout().currentSigner;
        if (currentSigner != address(0)) {
            uint256 status = cacheValidator(currentSigner);
            AuthFactorStorage.layout().currentSigner = address(0);
            if (status <= 2) {
                _;
            }
        } else {
            _;
        }
    }

    function getAllCachedValidators() public view returns(address[] memory) {
        return AuthFactorStorage.layout().cachedValidators.values();
    }

    function isCachedValidator(address validator) public view returns(bool) {
        return AuthFactorStorage.layout().cachedValidators.contains(validator);
    }

    function cacheValidator(address signer) public returns(uint256) {
        AuthFactor memory factor = AuthFactorStorage.getAuthFactor(1);
        if (factor.providerType <= 1) {
            return 0; // provider is validator, no need to cache
        }
        if (IAuthProvider(factor.provider).isRegistered(factor.name, signer)) {
            if (isCachedValidator(signer)) {
                return 1; // signer valid and cached
            } else {
                _cacheValidator(signer);
                return 2; // signer valid but not cached
            }
        } else {
            if (isCachedValidator(signer)) {
                _removeValidator(address(0));
                return 3; // signer not valid but cached
            } else {
                return 4; // signer not valid and not cached
            }
        }
    }

    function _cacheValidator(address validator) internal {
        AuthFactorStorage.layout().cachedValidators.add(validator);
        emit CachedValidatorAdded(validator);
    }

    function _removeValidator(address validator) internal {
        AuthFactorStorage.layout().cachedValidators.remove(validator);
        emit CachedValidatorRemoved(validator);
    }

    function _validateFirstFactor(
        bytes32 userOpHash,
        bytes memory signature
    ) internal returns(uint256) {
        AuthInput memory auth = abi.decode(signature, (AuthInput));
        require(
            AuthFactorStorage.getAuthFactorIndex(auth.factor) == 1,
            "first factor not found"
        );
        AuthFactor memory factor = auth.factor;
        if (factor.providerType <= 1) {
            bytes32 toSign = keccak256(abi.encode(bytes32(0), bytes32(0), userOpHash));
            if (!auth.signer.isValidSignatureNow(toSign, auth.signature)) {
                return 1; // fail if signature doesn't match signer
            }
            return auth.signer == factor.provider ? 0 : 1;            
        } else {
            IAuthProvider provider = IAuthProvider(factor.provider);
            bytes32 nameType = provider.getNameType();
            bytes32 toSign = keccak256(abi.encode(nameType, auth.factor.name, userOpHash));
            if (!auth.signer.isValidSignatureNow(toSign, auth.signature)) {
                return 1; // fail if signature doesn't match signer
            }
            if (_getNumOfCachedValidators() == 0 || isCachedValidator(auth.signer)) {
                AuthFactorStorage.layout().currentSigner = auth.signer;
                return 0;
            }
            return 1; // fail otherwise
        }
    }

    function _getNumOfCachedValidators() internal view returns(uint256) {
        return AuthFactorStorage.layout().cachedValidators.length();
    }

    function _validateSecondFactor(
        bytes32 message,
        AuthInput memory auth
    ) internal view {
        require(
            auth.signer.isValidSignatureNow(message, auth.signature),
            "signature mismatch"
        );
        uint256 index = AuthFactorStorage.getAuthFactorIndex(auth.factor);
        require(index > 1, "second factor not found");
        if (auth.factor.providerType <= 1) {
            require(auth.factor.provider == auth.signer, "invalid signer");
        } else {
            require(
                IAuthProvider(
                    auth.factor.provider
                ).isRegistered(auth.factor.name, auth.signer),
                "invalid signer for auth provider"
            );
        }
    }
}
