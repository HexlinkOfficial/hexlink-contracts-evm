//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract DummyUUPSImpl is UUPSUpgradeable {
    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view override { }
}