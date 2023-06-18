//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

library AuthProviderStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.provider');

    struct AuthProvider {
        bytes32 authProvider;
        address defaultValidator;
    }

    struct Layout {
        // nameType => authProvider
        mapping(bytes32 => address) authProviders;
        // authProviderKey => validators
        mapping(bytes32 => mapping(address => bool)) validators;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function getAuthProvider(bytes32 nameType) internal view returns(address) {
        return layout().authProviders[nameType];
    }

    function setAuthProvider(bytes32 nameType, address provider) internal {
        layout().authProviders[nameType] = provider;
    }

    function addValidators(
        bytes32 providerKey,
        address[] memory toSet
    ) internal {
        for (uint256 i = 0; i < toSet.length; i++) {
            address validator = toSet[i];
            layout().validators[providerKey][validator] = true;
        }
    }

    function removeValidators(
        bytes32 providerKey,
        address[] memory toRemove
    ) internal {
        for (uint256 i = 0; i < toRemove.length; i++) {
            address validator = toRemove[i];
            layout().validators[providerKey][validator] = false;
        }
    }

    function validators(bytes32 providerKey)
        internal
        view
        returns(mapping(address => bool) storage)
    {
        return layout().validators[providerKey];
    }
}