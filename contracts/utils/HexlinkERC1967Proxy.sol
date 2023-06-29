//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";
import "../interfaces/IHexlinkERC1967Proxy.sol";

contract HexlinkERC1967Proxy is IHexlinkERC1967Proxy, Proxy, ERC1967Upgrade {
    using Address for address;

    function implementation() external view override returns (address) {
        return _implementation();
    }

    function initProxy(address logic, bytes memory data) external override {
        require(_implementation() == address(0), "already initiated");
        _upgradeToAndCall(logic, data, false);
    }

    function _implementation() internal view virtual override returns (address) {
        return ERC1967Upgrade._getImplementation();
    }
}