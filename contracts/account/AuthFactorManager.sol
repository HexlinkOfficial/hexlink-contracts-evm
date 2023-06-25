
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./auth/provider/IAuthProvider.sol";
import "./base/AccountModuleBase.sol";
import "./structs.sol";

library AuthProviderEncoder {
    function encode(
        AuthProvider memory provider
    ) internal pure returns(bytes32) {
        uint256 part1 = uint256(uint160(provider.provider)) << 96;
        uint256 part2 = uint256(provider.providerType) << 88;
        return bytes32(part1 + part2);
    }

    function decode(
        bytes32 provider
    ) internal pure returns(AuthProvider memory) {
        return AuthProvider(
            address(bytes20(provider)),
            uint8(provider[20])
        );
    }
}

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor');
 
    struct Layout {
        AuthFactor first;
        EnumerableSet.Bytes32Set second;
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
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SignatureChecker for address;

    event FirstFactorProviderUpdated(AuthProvider indexed, AuthProvider indexed);
    event SecondFactorUpdated(AuthProvider indexed);
    event SecondFactorRemoved(AuthProvider indexed);

    modifier onlyValidSigner() {
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        if (provider.providerType == 0) {
            address currentSigner = AuthFactorStorage.layout().signer;
            uint256 status = _cacheValidator(
                IAuthProvider(provider.provider),
                currentSigner
            );
            if (status < 3) {
                _;
            }
        } else {
            _;
        }
    }

    function getFirstFactor() external view returns(AuthFactor memory factor) {
        return AuthFactorStorage.layout().first;
    }

    function updateFirstFactorProvider(
        AuthProvider memory provider,
        bytes memory data
    ) external onlySelf {
        if (provider.providerType == 0) {
            bytes32 nameType = AuthFactorStorage.layout().first.nameType;
            require(
                IAuthProvider(provider.provider).isSupportedNameType(nameType),
                "name type not supported"
            );
        }
        AuthProvider memory old = AuthFactorStorage.layout().first.provider;
        AuthFactorStorage.layout().first.provider = provider;
        if (data.length > 0) {
            provider.provider.functionCall(data);
        }
        emit FirstFactorProviderUpdated(old, provider);
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
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        if (provider.providerType == 0) {
            return 0; // provider is EOA
        }
        return _cacheValidator(IAuthProvider(provider.provider), signer);
    }

    function _cacheValidator(IAuthProvider provider, address signer) internal returns(uint256) {
        bytes32 name = AuthFactorStorage.layout().first.name;
        bytes32 nameType = AuthFactorStorage.layout().first.nameType;
        if (provider.isValidSigner(nameType, name, signer)) {
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
            "invalid first factor"
        );
        bytes32 message = keccak256(abi.encode(auth.factor, userOpHash));
        if (!auth.signer.isValidSignatureNow(message, auth.signature)) {
            return 1; // signature invalid
        }
        if (auth.factor.provider.providerType == 0) {
            AuthFactorStorage.layout().signer = auth.signer;
            bool cacheEmpty = AuthFactorStorage.layout().cached.length() == 0;
            return (cacheEmpty || isCachedValidator(auth.signer)) ? 0 : 2;
        } else {
            return auth.factor.provider.provider == auth.signer ? 0 : 2;
        }
    }

    function _encode(AuthFactor memory factor) internal pure returns(bytes32) {
        return keccak256(abi.encode(factor));
    }

    /** second factors */

    function getSecondFactors() external view returns(AuthProvider[] memory) {
        bytes32[] memory values = AuthFactorStorage.layout().second.values();
        AuthProvider[] memory result = new AuthProvider[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            result[i] = AuthProviderEncoder.decode(values[i]);
        }
        return result;
    }

    function addSecondFactor(
        AuthProvider memory provider,
        bytes memory data
    ) onlySelf external {
        bytes32 nameType = AuthFactorStorage.layout().first.nameType;
        require(nameType != ENS_NAME, "second factor not supported");
        bytes32 encoded = AuthProviderEncoder.encode(provider);
        AuthFactorStorage.layout().second.add(encoded);
        if (data.length > 0) {
            provider.provider.functionCall(data);
        }
        emit SecondFactorUpdated(provider);
    }

    function removeSecondFactor(AuthProvider memory provider) onlySelf external {
        bytes32 encoded = AuthProviderEncoder.encode(provider);
        AuthFactorStorage.layout().second.remove(encoded);
        emit SecondFactorRemoved(provider);
    }

    function _isSecondFactorEnabled() internal view returns(bool) {
        return AuthFactorStorage.layout().second.length() > 0;
    }

    function _validateSecondFactor(
        bytes32 requestHash,
        AuthInput memory auth
    ) internal view {
        bytes32 encoded = AuthProviderEncoder.encode(auth.factor.provider);
        require(
            AuthFactorStorage.layout().second.contains(encoded),
            "invalid second factor"
        );
        require(
            auth.signer.isValidSignatureNow(requestHash, auth.signature),
            "invalid signature"
        );
        if (auth.factor.provider.providerType == 0) {
            IAuthProvider provider = IAuthProvider(auth.factor.provider.provider);
            require(
                provider.isValidSigner(
                    auth.factor.nameType,
                    auth.factor.name,
                    auth.signer
                ),
                "invalid signer"
            );
        } else {
            require(auth.factor.provider.provider == auth.signer, "invalid signer");
        }
    }
}
