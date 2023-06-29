
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IAuthProvider.sol";
import "./base/AccountModuleBase.sol";
import "../interfaces/structs.sol";

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
        AuthValidator validator;
        EnumerableSet.Bytes32Set second;
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
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SignatureChecker for address;
    using ECDSA for bytes32;

    event FirstFactorProviderUpdated(AuthProvider indexed);
    event SecondFactorUpdated(AuthProvider indexed);
    event SecondFactorRemoved(AuthProvider indexed);

    modifier onlyValidSigner() {
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        if (provider.providerType != 0) {
            _;
        } else {
            address validator = _getAuthProviderValidator(provider.provider);
            AuthValidator memory signer = AuthFactorStorage.layout().validator;
            if (signer.signer != validator) {
                AuthFactorStorage.layout().validator = AuthValidator(validator, false);
            } else if (signer.isCurrent) {
                AuthFactorStorage.layout().validator.isCurrent = false;
                _;
            } else {
                _;
            }
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
            address validator = _getAuthProviderValidator(provider.provider);
            AuthFactorStorage.layout().validator = AuthValidator(validator, false);
        }
        AuthFactorStorage.layout().first.provider = provider;
        if (data.length > 0) {
            provider.provider.functionCall(data);
        }
        emit FirstFactorProviderUpdated(provider);
    }

    function _initFirstFactor(AuthFactor memory factor) internal {
        AuthFactorStorage.layout().first = factor;
    }

    function resetSigner() public {
        AuthProvider memory provider = AuthFactorStorage.layout().first.provider;
        require(provider.providerType == 0, "invalid provider type");
        address validator = _getAuthProviderValidator(provider.provider);
        AuthFactorStorage.layout().validator = AuthValidator(validator, false);
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
            address cached = AuthFactorStorage.layout().validator.signer;
            if (cached == address(0)) {
                AuthFactorStorage.layout().validator = AuthValidator(signer, true);
            }
            return cached == address(0) || cached == signer ? 0 : 2;
        } else {
            return provider.provider == signer ? 0 : 2;
        }
    }

    function _getAuthProviderValidator(
        address provider
    ) internal view returns(address) {
        return IAuthProvider(provider).getValidator(
            AuthFactorStorage.layout().first.nameType,
            AuthFactorStorage.layout().first.name
        );
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

    function addSecondFactor(AuthProvider memory provider, bytes memory data) onlySelf public {
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
    ) internal view {
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
            address validator = IAuthProvider(
                auth.factor.provider.provider
            ).getValidator(auth.factor.nameType, auth.factor.name);
            require(auth.signer == validator, "invalid signer");
        } else {
            require(
                auth.factor.provider.provider == auth.signer,
                "invalid signer"
            );
        }
    }
}
