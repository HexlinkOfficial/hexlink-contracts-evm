
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../utils/Constants.sol";
import "./auth/provider/IAuthProvider.sol";
import "./AccountModuleBase.sol";
import "./structs.sol";

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor.first');
 
    struct Layout {
        AuthFactor factor;
        EnumerableSet.AddressSet cachedValidators;
        address currentSigner;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract AuthFactorManager is AccountModuleBase {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;

    event FirstFactorUpdated(AuthFactor indexed);
    event CachedValidatorAdded(address validator);
    event CachedValidatorRemoved(address validator);

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

    function getFirstFactor() external view returns(AuthFactor memory factor) {
        return AuthFactorStorage.layout().factor;
    }

    function getAllCachedValidators() public view returns(address[] memory) {
        return AuthFactorStorage.layout().cachedValidators.values();
    }

    function isCachedValidator(address validator) public view returns(bool) {
        return AuthFactorStorage.layout().cachedValidators.contains(validator);
    }

    function updateFirstFactor(AuthFactor memory factor) onlySelf external {
        if (factor.providerType == 2) {
            bytes32 nameType = IAuthProvider(factor.provider).getNameType();
            require(
                hexlink.ownedAccount(nameType, factor.name) == address(this),
                "invalid name"
            );
        }
        _updateFirstFactor(factor);
        emit FirstFactorUpdated(factor);
    }

    function _updateFirstFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.layout().factor = factor;
    }

    function cacheValidator(address signer) public returns(uint256) {
        AuthFactor memory factor = AuthFactorStorage.layout().factor;
        if (factor.providerType < 2) {
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
        bytes calldata signature
    ) internal returns(uint256) {
        (address signer, bytes memory sig) = abi.decode(signature, (address, bytes));
        AuthFactor memory factor = AuthFactorStorage.layout().factor;
        if (factor.providerType <= 1) {
            bytes32 toSign = keccak256(abi.encode(bytes32(0), bytes32(0), userOpHash));
            if (!signer.isValidSignatureNow(toSign, sig)) {
                return 1; // fail if signature doesn't match signer
            }
            return signer == factor.provider ? 0 : 1;            
        } else {
            IAuthProvider provider = IAuthProvider(factor.provider);
            bytes32 nameType = provider.getNameType();
            bytes32 toSign = keccak256(abi.encode(nameType, factor.name, userOpHash));
            if (!signer.isValidSignatureNow(toSign, sig)) {
                return 1; // fail if signature doesn't match signer
            }
            if (_getNumOfCachedValidators() == 0 || isCachedValidator(signer)) {
                AuthFactorStorage.layout().currentSigner = signer;
                return 0;
            }
            return 1; // fail otherwise
        }
    }

    function _getNumOfCachedValidators() internal view returns(uint256) {
        return AuthFactorStorage.layout().cachedValidators.length();
    }
}
