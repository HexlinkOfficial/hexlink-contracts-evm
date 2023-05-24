// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./INameValidator.sol";

contract NameValidator is INameValidator {
    using ECDSA for bytes32;

    address immutable validator;

    constructor(address validator_) {
        validator = validator_;
    }

    /** INameValidator */

    function validate(
        bytes32 name,
        bytes32 message,
        bytes memory signature
    ) public view returns(uint256) {
        bytes32 toSignHash = keccak256(abi.encode(name, message));
        address signer = toSignHash.toEthSignedMessageHash().recover(signature);
        return signer == validator ? 0 : 1;
    }
}