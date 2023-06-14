
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";

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

abstract contract ModuleManager {
    using Address for address;

    function getModule(bytes32 key) view public returns(address) {
        return ModuleStorage.layout().modules[key];
    }

    function _setAndExecModule(
        bytes32 key,
        address module,
        bytes memory data
    ) internal {
        ModuleStorage.layout().modules[key] = module;
        if (module != address(0) && data.length > 0) {
            module.functionDelegateCall(data);
        }
    }

    function _execModule(bytes32 key, bytes memory data) internal returns(bytes memory) {
        address module = getModule(key);
        require(module != address(0) && data.length > 0, "module not set");
        return module.functionDelegateCall(data);
    }
}