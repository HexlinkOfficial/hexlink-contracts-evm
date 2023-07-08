// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../../../interfaces/IAuthProvider.sol";

contract SimpleAuthProvider is IAuthProvider {
    address immutable private _validator;
    string private _metadata;

    constructor(address validator, string memory metadata) {
       _validator = validator;
       _metadata = metadata;
    }

    function getValidator(
        address /* account */
    ) external view override returns(address) {
        return getDefaultValidator();
    }

    function getDefaultValidator() public view returns(address) {
        return _validator;
    }

    function getMetadata() external view override returns(string memory) {
        return _metadata;
    }
}