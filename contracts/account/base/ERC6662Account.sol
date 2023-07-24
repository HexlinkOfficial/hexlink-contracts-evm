
//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../interfaces/IERC6662Account.sol";

abstract contract ERC6662Account is IERC6662Account {
    address private immutable registry_;

    constructor(address registry) {
        registry_ = registry;
    }

    function getAuthRegistry()
        external
        view
        override
        returns(address)
    {
        return registry_;
    }
}
