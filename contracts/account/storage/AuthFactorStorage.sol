//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../utils/AuthFactorStruct.sol";

library AuthFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.factor.simple');
 
    struct Layout {
        // the first one is first factor
        // all the rest are second factors
        // we require first factor + one second factor
        // (if enabled) to authenticate the user
        AuthFactor[] factors;
        mapping(bytes32 => uint256) indexes;
        bool enableSecond;
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

    function isFirstFactor(AuthFactor memory factor) internal view returns(bool) {
        AuthFactor memory first = layout().factors[0];
        return first.name == factor.name && first.provider == factor.provider;
    }

    function isSecondFactor(AuthFactor memory factor) internal view returns(bool) {
        return layout().indexes[_encode(factor)] > 0;
    }

    function updateFirstFactor(AuthFactor memory factor) internal {
        if (layout().factors.length == 0) {
            layout().factors.push(factor);
        } else {
            layout().factors[0] = factor;
        }
    }

    function addSecondFactor(AuthFactor memory factor) internal returns(bool) {
        if (isSecondFactor(factor)) {
            return false;
        }
        layout().factors.push(factor);
        layout().indexes[_encode(factor)] = layout().factors.length - 1;
        return true;
    }

    function removeSecondFactor(AuthFactor memory factor) internal returns(bool) {
        bytes32 key = _encode(factor);
        uint256 valueIndex = layout().indexes[key];
        if (valueIndex == 0) {
            return false;
        }
        uint256 toDeleteIndex = valueIndex;
        uint256 lastIndex = layout().factors.length - 1;
        if (lastIndex != toDeleteIndex) {
            AuthFactor memory lastValue = layout().factors[lastIndex];
            layout().factors[toDeleteIndex] = lastValue;
            layout().indexes[_encode(lastValue)] = valueIndex;
        }
        layout().factors.pop();
        delete layout().indexes[key];
        return true;
    }
}
