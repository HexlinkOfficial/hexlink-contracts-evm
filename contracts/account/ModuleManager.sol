
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "./storage/ModuleStorage.sol";

abstract contract ModuleManager {
    using Address for address;

    function getModule(bytes32 key) view public returns(address) {
        return ModuleStorage.layout().modules[key];
    }

    function _setModule(bytes32 key, address module, bytes memory data) internal {
        ModuleStorage.layout().modules[key] = module;
        if (module != address(0)) {
            module.functionDelegateCall(data);
        }
    }

    function _callModule(bytes32 key, bytes memory data) internal returns(bytes memory) {
        address module = getModule(key);
        return module.functionDelegateCall(data);
    }
}