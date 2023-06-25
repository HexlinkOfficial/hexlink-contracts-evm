
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
        keccak256('hexlink.account.auth.factor');
 
    struct Layout {
        AuthFactor first;
        EnumerableSet.AddressSet second;
        EnumerableSet.AddressSet cached;
        address signer;
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

    event FirstFactorProviderUpdated(address indexed, address indexed);
    event SecondFactorUpdated(address indexed);
    event SecondFactorRemoved(address indexed);

    modifier onlyValidSigner() {
        address currentSigner = AuthFactorStorage.layout().signer;
        uint256 status = cacheValidator(currentSigner);
        if (status <= 2) {
            _;
        }
    }

    function getFirstFactor() external view returns(AuthFactor memory factor) {
        return AuthFactorStorage.layout().first;
    }

    function updateFirstFactorProvider(address newProvider) external onlySelf {
        bytes32 nameType = AuthFactorStorage.layout().first.nameType;
        require(
            IAuthProvider(newProvider).isSupportedNameType(nameType),
            "name type not supported"
        );
        address old = AuthFactorStorage.layout().first.provider;
        AuthFactorStorage.layout().first.provider = newProvider;
        emit FirstFactorProviderUpdated(old, newProvider);
    }

    function getAllCachedValidators() public view returns(address[] memory) {
        return AuthFactorStorage.layout().cached.values();
    }

    function isCachedValidator(address validator) public view returns(bool) {
        return AuthFactorStorage.layout().cached.contains(validator);
    }

    function _initFirstFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.layout().first = factor;
    }

    function cacheValidator(address signer) public returns(uint256) {
        AuthFactor memory factor = AuthFactorStorage.layout().first;
        IAuthProvider provider = IAuthProvider(factor.provider);
        if (provider.isValidSigner(factor.name, factor.nameType, signer)) {
            if (isCachedValidator(signer)) {
                return 1; // signer valid and cached
            } else {
                AuthFactorStorage.layout().cached.add(signer);
                return 2; // signer valid but not cached
            }
        } else {
            if (isCachedValidator(signer)) {
                AuthFactorStorage.layout().cached.remove(signer);
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
        AuthInput memory auth = abi.decode(signature, (AuthInput));
        require(
            _encode(auth.factor) == _encode(AuthFactorStorage.layout().first),
            "auth factor not set"
        );
        bytes32 message = keccak256(abi.encode(auth.factor, userOpHash));
        if (!auth.signer.isValidSignatureNow(message, auth.signature)) {
            return 1; // signature invalid
        }
        if (_getNumOfCachedValidators() == 0 || isCachedValidator(auth.signer)) {
            AuthFactorStorage.layout().signer = auth.signer;
            return 0;
        }
        return 2; // signer invalid
    }

    function _getNumOfCachedValidators() internal view returns(uint256) {
        return AuthFactorStorage.layout().cached.length();
    }

    function _encode(AuthFactor memory factor) internal pure returns(bytes32) {
        return keccak256(abi.encode(factor));
    }

    /** second factors */

    function getSecondFactors() external view returns(address[] memory) {
        return AuthFactorStorage.layout().second.values();
    }

    function addSecondFactor(address factor) onlySelf external {
        bytes32 nameType = AuthFactorStorage.layout().first.nameType;
        require(nameType != ENS_NAME, "second factor not supported");
        AuthFactorStorage.layout().second.add(factor);
        emit SecondFactorUpdated(factor);
    }

    function removeSecondFactor(address factor) onlySelf external {
        AuthFactorStorage.layout().second.remove(factor);
        emit SecondFactorRemoved(factor);
    }

    function _isSecondFactorEnabled() internal view returns(bool) {
        return AuthFactorStorage.layout().second.length() > 0;
    }

    function _validateSecondFactor(
        bytes32 requestHash,
        AuthInput memory auth
    ) internal view {
        require(
            AuthFactorStorage.layout().second.contains(auth.factor.provider),
            "factor not set"
        );
        IAuthProvider(auth.factor.provider).validateSignature(
            auth.factor.name,
            auth.factor.nameType,
            requestHash,
            auth.signer,
            auth.signature
        );
    }
}
