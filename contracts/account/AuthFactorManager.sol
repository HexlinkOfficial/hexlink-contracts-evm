
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./auth/provider/IAuthProvider.sol";
import "./base/AccountModuleBase.sol";
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
                AuthFactorStorage.layout().cachedValidators.add(signer);
                return 2; // signer valid but not cached
            }
        } else {
            if (isCachedValidator(signer)) {
                AuthFactorStorage.layout().cachedValidators.remove(signer);
                return 3; // signer not valid but cached
            } else {
                return 4; // signer not valid and not cached
            }
        }
    }

    function _validateFirstFactor(
        bytes32 userOpHash,
        bytes calldata signature
    ) internal returns(uint256) {
        (address signer, bytes memory sig) = abi.decode(signature, (address, bytes));
        AuthFactor memory factor = AuthFactorStorage.layout().factor;
        if (factor.providerType == 1) {
            return signer.isValidSignatureNow(userOpHash, sig)
                && signer == factor.provider ? 0 : 1;            
        } else {
            IAuthProvider provider = IAuthProvider(factor.provider);
            bytes32 nameType = provider.getNameType();
            bytes32 message = keccak256(abi.encode(nameType, factor.name, userOpHash));
            if (!signer.isValidSignatureNow(message, sig)) {
                return 1;
            }
            if (_getNumOfCachedValidators() == 0 || isCachedValidator(signer)) {
                AuthFactorStorage.layout().currentSigner = signer;
                return 0;
            }
            return 1;
        }
    }

    function _getNumOfCachedValidators() internal view returns(uint256) {
        return AuthFactorStorage.layout().cachedValidators.length();
    }

    function _getName() internal view returns(bytes32, bytes32) {
        AuthFactor memory factor = AuthFactorStorage.layout().factor;
        if (factor.providerType == 1) {
            return (bytes32(0), bytes32(0));
        }
        return (IAuthProvider(factor.provider).getNameType(), factor.name);
    }
}
