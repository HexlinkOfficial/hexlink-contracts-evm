//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "./base/AccountAuthBase.sol";
import "../interfaces/structs.sol";

library SecondFactorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256("hexlink.account.auth.factor.v2");

    struct Layout {
        EnumerableSet.AddressSet factors;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract SecondFactorManager is AccountAuthBase {
    using EnumerableSet for EnumerableSet.AddressSet;

    event SecondFactorUpdated(address indexed, bool enabled);

    error UnAuthorizedFirstFactorOwner(address owner);
    error UnAuthorizedERC4972Name(bytes32 name);
    error NameNotEnabled();
    error InvalidSignType(uint8 signType);

    function addSecondFactor(address factor) external onlySelf {
        SecondFactorStorage.layout().factors.add(factor);
        emit SecondFactorUpdated(factor, true);
    }

    function removeSecondFactor(address factor) external onlySelf {
        SecondFactorStorage.layout().factors.remove(factor);
        emit SecondFactorUpdated(factor, false);
    }

    function getSecondFactors() external view returns(address[] memory) {
        return SecondFactorStorage.layout().factors.values();
    }

    function isSecondFactorEnabled(address factor) public view returns(bool) {
        return SecondFactorStorage.layout().factors.contains(factor);
    }

    function getNumOfSecondFactors() public view returns(uint256) {
        return SecondFactorStorage.layout().factors.length();
    }

    function _validateSecondFactor(
        bytes32 message,
        bytes memory signature
    ) internal view returns(bool) {
        address signer = ECDSA.recover(message, signature);
        return isSecondFactorEnabled(signer);
    }
}
