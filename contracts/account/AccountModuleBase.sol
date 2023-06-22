//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

abstract contract AccountModuleBase { 
    modifier onlySelf() {
        require(msg.sender == address(this), "invalid caller");
        _;
    }
}