
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
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

    event FactorUpdated(uint256 indexed, address indexed, address indexed);

    modifier onlyValidSigner() {
        if (_revalidateFactor(0) && _revalidateFactor(1)) {
            _;
        }
    }

    function _revalidateFactor(uint256 index) internal returns(bool) {
        AuthFactor memory factor = AuthFactorStorage.layout().factors[index];
        if (factor.provider == address(0)) {
            return true;
        }
        address validator = IAuthProvider(
            factor.provider
        ).getValidator(address(this));
        if (factor.validator != validator) {
            AuthFactorStorage.layout().factors[index].validator = validator;
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

    function updateAuthFactor(uint256 index, address provider, address validator) external onlySelf {
        require(validator != address(0), "invalid validator");
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

    function _validateFirstFactor(
        bytes32 message,
        AuthInput memory input
    ) internal returns(uint256) {
        if (!input.signer.isValidSignatureNow(message, input.signature)) {
            return 1; // signature invalid
        }
        AuthFactor memory first = AuthFactorStorage.layout().factors[0];
        if (first.provider != address(0) && first.validator == address(0)) {
            AuthFactorStorage.layout().factors[0].validator = input.signer;
            AuthFactorStorage.layout().initiated = true;
            return 0;
        }
        return first.validator == input.signer ? 0 : 2;
    }

    function _validateSecondFactor(
        bytes32 message,
        AuthInput memory input
    ) internal view returns(uint256) {
        address validator = AuthFactorStorage.layout().factors[1].validator;
        if(input.signer.isValidSignatureNow(message, input.signature)) {
            return 1;
        }
        return input.signer == validator ? 0 : 2;
    }

    function _isSecondFactorEnabled() internal view returns(bool) {
        return AuthFactorStorage.layout().factors[1].validator != address(0);
    }
}
