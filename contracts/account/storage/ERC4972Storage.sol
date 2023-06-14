//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

library ERC4972Storage {
    struct Layout {
        bytes32 nameType;
        bytes32 name;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.storage.account.eip4972');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function setName(
        bytes32 nameType,
        bytes32 name
    ) internal {
        Layout storage s = layout();
        s.nameType = nameType;
        s.name = name;
    }

    function getName() internal pure returns(bytes32, bytes32) {
        Layout memory s = layout();
        return (s.nameType, s.name);
    }
}