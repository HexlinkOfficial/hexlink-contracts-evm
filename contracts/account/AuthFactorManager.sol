//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "./base/ERC4972Account.sol";
import "../interfaces/structs.sol";

struct FirstFactor {
    address owner;
    bool initialized;
    bool nameEnabled;
}

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256("hexlink.account.auth.factor.v2");

    struct Layout {
        FirstFactor first;
        EnumerableSet.AddressSet second;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract AuthFactorManager is ERC4972Account {
    using SignatureChecker for address;
    using ECDSA for bytes32;
    using EnumerableSet for EnumerableSet.AddressSet;

    event FirstFactorUpdated(address indexed, bool nameEnabled);
    event SecondFactorUpdated(address indexed, bool enabled);

    error UnAuthorizedFirstFactorOwner(address owner);
    error UnAuthorizedERC4972Name(bytes32 name);
    error NameNotEnabled();
    error InvalidFirstFactorOwnerToSet(address owner);
    error InvalidSignType(uint8 signType);

    /** First Factor */

    modifier onlyValidFirstFactor() {
        FirstFactor memory first = AuthFactorStorage.layout().first;
        if (first.nameEnabled) {
            if (!_isOwner(first.owner)) {
                revert UnAuthorizedFirstFactorOwner(first.owner);
            }
            if (!first.initialized) {
                AuthFactorStorage.layout().first.initialized = true;
            }
        }
        _;
    }

    function resetFirstFactorViaNameService(address owner) public {
        FirstFactor memory first = AuthFactorStorage.layout().first;
        if (!first.nameEnabled) {
            revert NameNotEnabled();
        }
        if (owner == address(0) || owner == first.owner || !_isOwner(owner)) {
            revert InvalidFirstFactorOwnerToSet(owner);
        }
        AuthFactorStorage.layout().first = FirstFactor(owner, true, true);
        emit FirstFactorUpdated(owner, true);
    }

    function updateFirstFactor(address factor, bool nameEnabled) external onlySelf {
        if (factor == address(0) || (nameEnabled && !_isOwner(factor))) {
            revert InvalidFirstFactorOwnerToSet(factor);
        }
        AuthFactorStorage.layout().first =
            FirstFactor(factor, true, nameEnabled);
        emit FirstFactorUpdated(factor, nameEnabled);
    }

    function getFirstFactor() external view returns(FirstFactor memory) {
        return AuthFactorStorage.layout().first;
    }

    function _initFirstFactor(address factor) internal {
        AuthFactorStorage.layout().first = FirstFactor(
            factor,
            factor == address(0),
            true
        );
    }

    function _validateFirstFactor(
        bytes32 userOpHash,
        AuthInput memory input
    ) internal returns(uint256) {
        bytes32 message = keccak256(abi.encodePacked(input.timeRange, userOpHash));
        FirstFactor memory first = AuthFactorStorage.layout().first;
        if (first.nameEnabled) {
            bytes32 name = getName();
            if (name == bytes32(0)) {
                address owned = getERC4972Registry().getOwnedAccount(input.name);
                if (owned != address(this)) {
                    revert UnAuthorizedERC4972Name(input.name);
                }
                name = input.name;
            }
            if (!first.initialized) {
                AuthFactorStorage.layout().first.owner = input.signer;
            }
            message = keccak256(abi.encodePacked(name, message));
        }
        bool sigValid = input.signer.isValidSignatureNow(
            message.toEthSignedMessageHash(),
            input.signature
        );
        sigValid = sigValid && input.signer == first.owner;
        return sigValid ? (uint256(input.timeRange) << 160) : 1;
    }

    /** Second Factor */

    function addSecondFactor(address factor) external onlySelf {
        AuthFactorStorage.layout().second.add(factor);
        emit SecondFactorUpdated(factor, true);
    }

    function removeSecondFactor(address factor) external onlySelf {
        AuthFactorStorage.layout().second.remove(factor);
        emit SecondFactorUpdated(factor, false);
    }

    function getSecondFactors() external view returns(address[] memory) {
        return AuthFactorStorage.layout().second.values();
    }

    function isSecondFactorEnabled(address factor) public view returns(bool) {
        return AuthFactorStorage.layout().second.contains(factor);
    }

    function _validateSecondFactor(
        bytes32 userOpHash,
        AuthInput memory input2
    ) internal view returns(uint256) {
        bytes32 message = keccak256(abi.encodePacked(input2.timeRange, userOpHash));
        bool sigValid = input2.signer.isValidSignatureNow(
            message.toEthSignedMessageHash(),
            input2.signature
        );
        sigValid = sigValid && isSecondFactorEnabled(input2.signer);
        return sigValid ? (uint256(input2.timeRange) << 160) : 1;
    }

    /** auth factor validation */

    function _validateAuthFactors(
        bytes32 userOpHash,
        bytes calldata signature
    ) internal returns (uint256 validationData) {
        uint8 signType = uint8(signature[0]);
        if(signType != 0x03) {
            revert InvalidSignType(signType);
        }
        (AuthInput memory input1, uint256 processed) = _decodeAuthInput(1, signature);
        validationData = _validateFirstFactor(userOpHash, input1);
        if (validationData != 1 && AuthFactorStorage.layout().second.length() > 0) {
            (AuthInput memory input2,) = _decodeAuthInput(1 + processed, signature);
            uint256 validationData2 = _validateSecondFactor(userOpHash, input2);
            if (validationData2 == 1) {
                validationData = validationData2;
            } else {
                validationData = _packValidationData(
                    _intersectTimeRange(validationData2, validationData)
                );
            }
        }
    }

    function _decodeAuthInput(
        uint256 start,
        bytes calldata signature
    ) private pure returns(AuthInput memory result, uint256 processed) {
        result.timeRange = uint96(bytes12(signature[start:start + 12]));
        result.signer = address(bytes20(signature[start + 12:start + 32]));
        result.name = bytes32(signature[start + 32:start + 64]);
        uint32 sigLength = uint32(bytes4(signature[start + 64:start + 68]));
        result.signature = signature[start + 68:start + 68 + sigLength];
        processed = 68 + sigLength;
    }
}
