//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./AccountAuthBase.sol";

library Simple2FAStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256("hexlink.account.auth.2fa");

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

abstract contract Simple2FA is AccountAuthBase {
    using EnumerableSet for EnumerableSet.AddressSet;

    event SecondFactorAdded(address indexed);
    event SecondFactorRemoved(address indexed);

    function addSecondFactor(address factor) external onlySelf {
        Simple2FAStorage.layout().factors.add(factor);
        emit SecondFactorAdded(factor);
    }

    function removeSecondFactor(address factor) external onlySelf {
        Simple2FAStorage.layout().factors.remove(factor);
        emit SecondFactorRemoved(factor);
    }

    function getSecondFactors() external view returns(address[] memory) {
        return Simple2FAStorage.layout().factors.values();
    }

    function isSecondFactorEnabled(address factor) public view returns(bool) {
        return Simple2FAStorage.layout().factors.contains(factor);
    }

    function getNumOfSecondFactors() public view returns(uint256) {
        return Simple2FAStorage.layout().factors.length();
    }

    function _validateSecondFactor(
        bytes32 message,
        bytes memory signature
    ) internal view returns(bool) {
        address signer = ECDSA.recover(message, signature);
        return isSecondFactorEnabled(signer);
    }
}
