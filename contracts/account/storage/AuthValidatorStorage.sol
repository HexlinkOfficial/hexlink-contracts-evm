//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library AuthValidatorStorage {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.validator');

    struct AuthProvider {
        bytes32 authProvider;
        address defaultValidator;
    }

    struct Layout {
        mapping(bytes32 => EnumerableSet.AddressSet) validators;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function add(
        bytes32 provider,
        address[] memory validators
    ) internal {
        for (uint256 i = 0; i < validators.length; i++) {
            layout().validators[provider].add(validators[i]);
        }
    }

    function remove(
        bytes32 provider,
        address[] memory validators
    ) internal {
        for (uint256 i = 0; i < validators.length; i++) {
            layout().validators[provider].remove(validators[i]);
        }
    }

    function contains(
        bytes32 providerKey,
        address validator
    ) internal view returns(bool) {
        return layout().validators[providerKey].contains(validator);
    }

    function getAll(bytes32 providerKey)
        internal
        view
        returns(address[] memory)
    {
        return layout().validators[providerKey].values();
    }
}