// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../../../interfaces/IAuthProvider.sol";

contract SimpleAuthProvider is IAuthProvider {
    address immutable private _validator;

    constructor(address validator) {
       _validator = validator;
    }

    function getValidator(
        address /* account */
    ) external view override returns(address) {
        return _validator;
    }
}