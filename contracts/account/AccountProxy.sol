// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";

contract AccountProxy is Proxy {
    address immutable public beacon;

    constructor(address _beacon) {
        beacon = _beacon;
    }

    function _implementation() internal override view returns (address) {
        return IBeacon(beacon).implementation();
    }
}