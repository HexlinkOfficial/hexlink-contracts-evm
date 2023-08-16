//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

abstract contract AccountAuthBase {
    error OnlySelfCallAllowed();

    modifier onlySelf() {
        if (msg.sender != address(this)) {
            revert OnlySelfCallAllowed();
        }
        _;
    }

    address immutable internal hexlink_;

    constructor(address hexlink) {
        hexlink_ = hexlink;
    }
}