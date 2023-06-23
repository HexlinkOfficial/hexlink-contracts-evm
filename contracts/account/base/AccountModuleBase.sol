//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../hexlink/IAccountFactory.sol";

abstract contract AccountModuleBase {
    IAccountFactory immutable public hexlink;

    modifier onlySelf() {
        require(msg.sender == address(this), "invalid caller");
        _;
    }

    constructor(address hexlink_) {
        hexlink = IAccountFactory(hexlink_);
    }
}