
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./auth/provider/IStaticAuthProvider.sol";
import "./auth/provider/IDynamicAuthProvider.sol";
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
    using ECDSA for bytes32;

    event FirstFactorProviderUpdated(AuthProvider indexed, AuthProvider indexed);
    event SecondFactorUpdated(AuthProvider indexed);
    event SecondFactorRemoved(AuthProvider indexed);

    modifier onlyValidSigner() {
        AuthProvider memory authProvider = AuthFactorStorage.layout().first.provider;
        if (authProvider.providerType == 0) {
            IStaticAuthProvider staticProvider
                = IStaticAuthProvider(authProvider.provider);
            address successor = staticProvider.getSuccessor();
            if (successor == address(0)) {
                _;
            } else {
                AuthFactorStorage.layout().first.provider.provider = successor;
            }
        } else if (authProvider.providerType == 1) {
            address signer = AuthFactorStorage.layout().signer;
            IDynamicAuthProvider dynamicProvider
                = IDynamicAuthProvider(authProvider.provider);
            if (_cacheDynamicValidator(dynamicProvider, signer) < 3) {
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
        if (provider.providerType <= 1) {
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

    function rotateStaticProvider() public {
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        require(provider.providerType == 0, "invalid provider type");
        address successor = IStaticAuthProvider(provider.provider).getSuccessor();
        require(successor != address(0), "no need to rotate");
        AuthFactorStorage.layout().first.provider.provider = successor;
    }

    function cacheDynamicValidator(address signer) public {
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        require(provider.providerType == 1, "invalid provider type");
        _cacheDynamicValidator(IDynamicAuthProvider(provider.provider), signer);
    }

    function _cacheDynamicValidator(
        IDynamicAuthProvider provider,
        address signer
    ) internal returns(uint256) {
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
        (address signer, bytes memory sig)= abi.decode(signature, (address, bytes));
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        bytes32 message = userOpHash.toEthSignedMessageHash();
        if (!signer.isValidSignatureNow(message, sig)) {
            return 1; // signature invalid
        }

        if (provider.providerType == 0) {
            address validator = IStaticAuthProvider(provider.provider).getValidator();
            return validator == signer ? 0 : 1;
        } else if (provider.providerType == 1) {
            AuthFactorStorage.layout().signer = signer;
            bool cacheEmpty = AuthFactorStorage.layout().cached.length() == 0;
            return (cacheEmpty || isCachedValidator(signer)) ? 0 : 2;
        } else {
            return provider.provider == signer ? 0 : 2;
        }
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
    ) onlySelf public {
        bytes32 nameType = AuthFactorStorage.layout().first.nameType;
        require(nameType != ENS_NAME, "second factor not supported");
        bytes32 encoded = AuthProviderEncoder.encode(provider);
        AuthFactorStorage.layout().second.add(encoded);
        if (data.length > 0) {
            provider.provider.functionCall(data);
        }
        emit SecondFactorUpdated(provider);
    }

    function removeSecondFactor(AuthProvider memory provider) onlySelf public {
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
    ) internal {
        bytes32 encoded = AuthProviderEncoder.encode(auth.factor.provider);
        require(
            AuthFactorStorage.layout().second.contains(encoded),
            "invalid second factor"
        );
        bytes32 message = requestHash.toEthSignedMessageHash();
        require(
            auth.signer.isValidSignatureNow(message, auth.signature),
            "invalid signature"
        );
        if (auth.factor.provider.providerType == 0) {
            IStaticAuthProvider provider = IStaticAuthProvider(auth.factor.provider.provider);
            address successor = provider.getSuccessor();
            if (successor == address(0)) {
                require(auth.signer == provider.getValidator(), "invalid signer");
            } else {
                address validator = IStaticAuthProvider(successor).getValidator();
                require(auth.signer == validator, "invalid signer");
                removeSecondFactor(auth.factor.provider);
                addSecondFactor(AuthProvider(successor, 0), "");
            }
        } else if (auth.factor.provider.providerType == 1) {
            require(
                IDynamicAuthProvider(auth.factor.provider.provider).isValidSigner(
                    auth.factor.nameType,
                    auth.factor.name,
                    auth.signer
                ),
                "invalid signer"
            );
        } else {
            require(
                auth.factor.provider.provider == auth.signer,
                "invalid signer"
            );
        }
    }
}
