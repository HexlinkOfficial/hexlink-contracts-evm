//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../hexlink/IAccountFactory.sol";
import "../../utils/Constants.sol";

abstract contract AccountModuleBase is Constants {
    IAccountFactory immutable public hexlink;

    modifier onlySelf() {
        require(msg.sender == address(this), "invalid caller");
        _;
    }

    modifier onlyOwnedAccount(bytes32 nameType, bytes32 name) {
        require(
            hexlink.ownedAccount(nameType, name) == address(this),
            "not owned account"
        );
        _;
    }

    constructor(address hexlink_) {
        hexlink = IAccountFactory(hexlink_);
    }
}