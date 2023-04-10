// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./INameRegistry.sol";

library RegistryStorage {
    struct Layout {
        mapping(bytes32 => mapping(bytes32 => address)) registries;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.contracts.storage.RegistryStorage');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function register(
        bytes32 schema,
        bytes32 domain,
        address registry
    ) internal {
        layout().registries[schema][domain] = registry;
    }

    function getRegistry(
        bytes32 schema,
        bytes32 domain
    ) internal view returns(address registry) {
        registry = layout().registries[schema][domain];
        if (registry == address(0)) {
            registry = layout().registries[schema][bytes32(0)];
        }
    }
}