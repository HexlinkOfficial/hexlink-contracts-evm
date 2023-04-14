//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

contract HexlinkERC1967Proxy is Proxy, ERC1967Upgrade {
    using Address for address;

    function implementation() external view returns (address) {
        return _implementation();
    }

    function upgradeToAndCallFromProxy(address logic, bytes memory data) external {
        if (_implementation() == address(0)) {
            _upgradeToAndCall(logic, data, false);
        }
    }

    function _implementation() internal view virtual override returns (address) {
        return ERC1967Upgrade._getImplementation();
    }
}