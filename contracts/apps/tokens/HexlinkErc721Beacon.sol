//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract HexlinkErc721Beacon is UpgradeableBeacon {
    constructor(address impl, address owner) UpgradeableBeacon(impl) {
        _transferOwnership(owner);
    }
}