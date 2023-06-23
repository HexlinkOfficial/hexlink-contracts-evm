
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./auth/provider/IAuthProvider.sol";
import "./base/AccountModuleBase.sol";
import "./structs.sol";

library SecondFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor.second');
 
    struct Layout {
        AuthFactor[] factors;
        mapping(bytes32 => uint256) indexes;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function _encode(AuthFactor memory factor) private pure returns(bytes32) {
        return keccak256(abi.encode(factor));
    }

    function getIndex(AuthFactor memory factor) internal view returns(uint256) {
        return layout().indexes[_encode(factor)];
    }

    function addSecondFactor(AuthFactor memory factor) internal {
        require(SecondFactorStorage.getIndex(factor) == 0, "already added");
        layout().factors.push(factor);
        layout().indexes[_encode(factor)] = layout().factors.length;
    }

    function removeSecondFactor(AuthFactor memory factor) internal {
        AuthFactor[] storage factors = layout().factors;
        mapping(bytes32 => uint256) storage indexes = layout().indexes;
        bytes32 key = _encode(factor);
        uint256 valueIndex = indexes[key];
        require(valueIndex > 1, "factor not found");
        uint256 toDeleteIndex = valueIndex - 1;
        uint256 lastIndex = factors.length - 1;
        if (lastIndex != toDeleteIndex) {
            AuthFactor memory lastValue = factors[lastIndex];
            factors[toDeleteIndex] = lastValue;
            indexes[_encode(lastValue)] = valueIndex;
        }
        factors.pop();
        delete indexes[key];
    }
}

abstract contract SecondFactorManager is AccountModuleBase {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;

    event SecondFactorUpdated(AuthFactor indexed);
    event SecondFactorRemoved(AuthFactor indexeD);

    function getSecondFactors() external view returns(AuthFactor[] memory factors) {
        return SecondFactorStorage.layout().factors;
    }

    function addSecondFactor(AuthFactor memory factor) onlySelf external {
        SecondFactorStorage.addSecondFactor(factor);
        emit SecondFactorUpdated(factor);
    }

    function removeSecondFactor(AuthFactor memory factor) onlySelf external {
        SecondFactorStorage.removeSecondFactor(factor);
        emit SecondFactorRemoved(factor);
    }

    function _isSecondFactorEnabled() internal view returns(bool) {
        return SecondFactorStorage.layout().factors.length > 1;
    }

    function _validateSecondFactor(
        bytes32 message,
        AuthInput memory auth
    ) internal view {
        require(
            auth.signer.isValidSignatureNow(message, auth.signature),
            "signature mismatch"
        );
        uint256 index = SecondFactorStorage.getIndex(auth.factor);
        require(index > 0, "second factor not found");
        if (auth.factor.providerType == 1) {
            require(auth.factor.provider == auth.signer, "invalid signer");
        } else {
            require(
                IAuthProvider(
                    auth.factor.provider
                ).isRegistered(auth.factor.name, auth.signer),
                "invalid signer for auth provider"
            );
        }
    }
}
