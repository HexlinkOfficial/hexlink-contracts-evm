// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../interfaces/INameService.sol";

contract SimpleNameService is INameService {
    address immutable private validator_;

    constructor(address validator) {
        validator_ = validator;
    }

    function defaultOwner() external view override returns(address) {
        return validator_;
    }

    function owner(bytes32 /* name */) external view override returns(address) {
        return validator_;
    }
}