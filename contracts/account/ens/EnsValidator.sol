
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../../utils/Constants.sol";
import "../auth/provider/IAuthProvider.sol";
import "../structs.sol";

library EnsValidatorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.ens');
 
    struct Layout {
        bytes32 name;
        address validator;
        address currentSigner;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract EnsValidator {
    using SignatureChecker for address;

    event CachedValidatorAdded(address validator);
    event CachedValidatorRemoved(address validator);

    IAuthProvider private immutable _provider;

    modifier onlyValidSigner() {
        address currentSigner = EnsValidatorStorage.layout().currentSigner;
        if (currentSigner != address(0)) {
            uint256 status = cacheValidator(currentSigner);
            EnsValidatorStorage.layout().currentSigner = address(0);
            if (status <= 2) {
                _;
            }
        } else {
            _;
        }
    }

    constructor(address ensAuthProvider) {
         _provider = IAuthProvider(ensAuthProvider);
    } 

    function _initName(bytes32 name) internal {
        EnsValidatorStorage.layout().name = name;
    }

    function getCachedValidator() public view returns(address) {
        return EnsValidatorStorage.layout().validator;
    }

    function cacheValidator(address signer) public returns(uint256) {
        bytes32 name = EnsValidatorStorage.layout().name;
        if (_provider.isRegistered(name, signer)) {
            if (getCachedValidator() == signer) {
                return 1; // signer valid and cached
            } else {
                EnsValidatorStorage.layout().validator = signer;
                return 2; // signer valid but not cached
            }
        } else {
            if (getCachedValidator() == signer) {
                EnsValidatorStorage.layout().validator = address(0);
                return 3; // signer not valid but cached
            } else {
                return 4; // signer not valid and not cached
            }
        }
    }

    function _validate(
        bytes32 userOpHash,
        bytes calldata signature
    ) internal returns(uint256) {
        (address signer, bytes memory sig) = abi.decode(signature, (address, bytes));
        bytes32 name = EnsValidatorStorage.layout().name;
        bytes32 toSign = keccak256(
            abi.encode(_provider.getNameType(), name, userOpHash)
        );
        if (!signer.isValidSignatureNow(toSign, sig)) {
            return 1;
        }
        address validator = getCachedValidator();
        EnsValidatorStorage.layout().currentSigner = signer;
        return validator == address(0) || validator == signer ? 0 : 1;
    }

    function _getName() internal view returns(bytes32, bytes32) {
        bytes32 name = EnsValidatorStorage.layout().name;
        return (name, _provider.getNameType());
    }
}
