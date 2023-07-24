//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";

contract HexlinkERC1967Proxy is Proxy, ERC1967Upgrade {
    error ERC1967ProxyAlreadyInitiated();

    function initProxy(address logic, bytes memory data) external {
        if (_implementation() != address(0)) {
            revert ERC1967ProxyAlreadyInitiated();
        }
        _upgradeToAndCall(logic, data, false);
    }

    function _implementation() internal view override returns (address) {
        return ERC1967Upgrade._getImplementation();
    }
}
