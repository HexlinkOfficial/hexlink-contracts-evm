//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../hexlink/IERC4972.sol";

abstract contract AccountModuleBase {
    IERC4972 immutable public hexlink;

    modifier onlySelf() {
        require(msg.sender == address(this), "invalid caller");
        _;
    }

    constructor(address hexlink_) {
        hexlink = IERC4972(hexlink_);
    }
}