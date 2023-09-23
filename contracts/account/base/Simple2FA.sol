//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./AccountAuthBase.sol";
import "hardhat/console.sol";

library Simple2FAStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256("hexlink.account.auth.2fa");

    struct Layout {
        bool enabled;
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
    using ECDSA for bytes32;

    error EmptySecondFactorList();

    event EnableSecondFactor();
    event DisableSecondFactor();
    event FactorAdded(address indexed);
    event FactorRemoved(address indexed);

    function enableSecondFactor() external onlySelf {
        if (Simple2FAStorage.layout().factors.length() == 0) {
            revert EmptySecondFactorList();
        }
        Simple2FAStorage.layout().enabled = true;
        emit EnableSecondFactor();
    }

    function disableSecondFactor() external onlySelf {
        Simple2FAStorage.layout().enabled = false;
        emit DisableSecondFactor();
    }

    function isSecondFactorEnabled() public view returns(bool) {
        return Simple2FAStorage.layout().enabled;
    }

    function addSecondFactor(address factor) external onlySelf {
        Simple2FAStorage.layout().factors.add(factor);
        emit FactorAdded(factor);
    }

    function removeSecondFactor(address factor) external onlySelf {
        Simple2FAStorage.layout().factors.remove(factor);
        if (
            Simple2FAStorage.layout().factors.length() == 0
            && isSecondFactorEnabled()
        ) {
            revert EmptySecondFactorList();
        }
        emit FactorRemoved(factor);
    }

    function getAllSecondFactors() external view returns(address[] memory) {
        return Simple2FAStorage.layout().factors.values();
    }

    function isValidSecondFactor(address factor) public view returns(bool) {
        return Simple2FAStorage.layout().factors.contains(factor);
    }

    function _validateSecondFactor(
        bytes32 message,
        bytes memory signature
    ) internal view returns(bool) {
        address signer = ECDSA.recover(message.toEthSignedMessageHash(), signature);
        return isValidSecondFactor(signer);
    }
}
