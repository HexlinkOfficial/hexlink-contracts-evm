//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

library AccountStorage {
    struct Layout {
        bytes32 name;
        address nameRegistry;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.contracts.storage.AccountStorage');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}