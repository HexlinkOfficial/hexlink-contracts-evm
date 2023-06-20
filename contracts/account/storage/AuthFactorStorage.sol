//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../auth/IAuthProvider.sol";

struct AuthFactor {
    bytes32 name;
    IAuthProvider provider;
}

struct AuthContext {
    address signer;
    uint96 index;
}

struct AuthContexts {
    AuthContext first;
    AuthContext second;
}

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor');
 
    struct Layout {
        // the first one is first factor
        // all the rest are second factors
        // we require first factor + one second factor
        // (if enabled) to authenticate the user
        AuthFactor[] factors;
        mapping(bytes32 => uint256) indexes;
        bool enableSecond;
        mapping(address => EnumerableSet.AddressSet) cachedValidators;
        // context of current user op
        AuthContexts contexts;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function _encode(AuthFactor memory factor) private pure returns(bytes32) {
        return keccak256(abi.encode(factor.name, factor.provider));
    }

    function getAuthFactor(uint96 index) internal view returns(AuthFactor storage) {
        require(index < layout().factors.length, "index out of bound");
        return layout().factors[index];
    }

    function getAuthFactorIndex(AuthFactor memory factor) internal view returns(uint256) {
        return layout().indexes[_encode(factor)];
    }

    function updateFirstFactor(AuthFactor memory factor) internal {
        AuthFactor[] storage factors = layout().factors;
        mapping(bytes32 => uint256) storage indexes = layout().indexes;
        if (factors.length == 0) {
            factors.push(factor);
            indexes[_encode(factor)] = 1;
        } else {
            AuthFactor memory old = factors[0];
            delete indexes[_encode(old)];
            factors[0] = factor;
            indexes[_encode(factor)] = 1;
        }
    }

    function addSecondFactor(AuthFactor memory factor) internal {
        require(AuthFactorStorage.getAuthFactorIndex(factor) == 0, "already added");
        layout().factors.push(factor);
        layout().indexes[_encode(factor)] = layout().factors.length - 1;
    }

    function removeSecondFactor(AuthFactor memory factor) internal {
        AuthFactor[] storage factors = layout().factors;
        mapping(bytes32 => uint256) storage indexes = layout().indexes;
        bytes32 key = _encode(factor);
        uint256 valueIndex = indexes[key];
        require(valueIndex > 1, "factor not found");
        uint256 toDeleteIndex = valueIndex;
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
