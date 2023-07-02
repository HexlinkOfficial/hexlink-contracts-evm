
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "../interfaces/IAuthProvider.sol";
import "./base/ERC4972Account.sol";
import "../interfaces/structs.sol";

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor');
 
    struct Layout {
        AuthFactor[2] factors;
        bool initiated;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract AuthFactorManager is ERC4972Account {
    using Address for address;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SignatureChecker for address;
    using ECDSA for bytes32;

    event FactorUpdated(uint256 indexed, address indexed, address indexed);

    modifier onlyValidSigner() {
        if (_revalidateFactor(0) && _revalidateFactor(1)) {
            _;
        }
    }

    function _revalidateFactor(uint256 index) internal returns(bool) {
        AuthFactor storage factor = AuthFactorStorage.layout().factors[index];
        address provider = factor.provider;
        if (provider == address(0)) {
            return true;
        }
        address validator = IAuthProvider(provider).getValidator(address(this));
        if (factor.validator != validator) {
            factor.validator = validator;
            return false;
        } else if (index == 0 && AuthFactorStorage.layout().initiated) {
            AuthFactorStorage.layout().initiated = false;
            return true;
        } else {
            return true;
        }
    }

    function _initFirstFactor(address provider) internal {
        AuthFactorStorage.layout().factors[0].provider = provider;
    }

    function getAuthFactors() external view returns(AuthFactor[2] memory) {
        return AuthFactorStorage.layout().factors;
    }

    function isSecondFactorEnabled() public view returns(bool) {
        return AuthFactorStorage.layout().factors[1].validator != address(0);
    }

    function updateAuthFactor(uint256 index, address provider, address validator) external onlySelf {
        require(index < 2 && validator != address(0), "invalid input");
        AuthFactorStorage.layout().factors[index].provider = provider;
        AuthFactorStorage.layout().factors[index].validator = validator;
        if (provider != address(0)) {
            address expected = IAuthProvider(provider).getValidator(address(this));
            require(validator == expected, "validator mismatch");
        }
        emit FactorUpdated(index, provider, validator);
    }

    function resetValidatorFromProvider(uint256 index) public {
        AuthFactor memory factor  = AuthFactorStorage.layout().factors[index];
        require(factor.provider != address(0), "invalid provider");
        address signer = IAuthProvider(factor.provider).getValidator(address(this));
        require(signer != factor.validator, "no need to reset");
        AuthFactorStorage.layout().factors[index].validator = signer;
    }

    function _validateAuthFactors(
        bytes32 userOpHash,
        bytes memory signature
    ) internal returns(uint256 validationData) {
        if (isSecondFactorEnabled()) {
            (
                AuthInput memory first,
                AuthInput memory second
            ) = abi.decode(signature, (AuthInput, AuthInput));
            validationData = _validateAuthFactor(0, userOpHash, first);
            if (uint160(validationData) == 0) {
                ValidationData memory data = _intersectTimeRange(
                    first.validationData,
                    second.validationData
                );
                second.validationData = _packValidationData(data);
                validationData = _validateAuthFactor(1, userOpHash, second);
            }
        } else {
            (AuthInput memory input) = abi.decode(signature, (AuthInput));
            validationData = _validateAuthFactor(0, userOpHash, input);
        }
    }

    function _validateAuthFactor(
        uint256 index,
        bytes32 userOpHash,
        AuthInput memory input
    ) internal returns(uint256) {
        AuthFactor memory factor = AuthFactorStorage.layout().factors[index];
        if (index == 0 && factor.provider != address(0) && factor.validator == address(0)) {
            AuthFactorStorage.layout().factors[0].validator = input.signer;
            AuthFactorStorage.layout().initiated = true;
            factor.validator = input.signer;
        }
        bytes32 message = keccak256(abi.encode(input.validationData, userOpHash));
        bool sigValid = input.signer.isValidSignatureNow(
            message.toEthSignedMessageHash(),
            input.signature
        ) && input.signer == factor.validator;
        return input.validationData | (sigValid ? 0 : 1);
    }
}
