//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

library ModuleStorage {
    struct Layout {
        mapping(bytes32 => address) modules;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.storage.account.modules');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}