// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../storage/ERC4972Storage.sol";
import "./IAuthModule.sol";

contract DefaultAuthModule is IAuthModule {
    using ECDSA for bytes32;

    address public immutable validator;

    constructor(address validator_) {
        validator = validator_;
    }

    function setName(bytes32 nameType, bytes32 name) external {
        ERC4972Storage.setName(nameType, name);
    }

    function getName() public pure returns(bytes32, bytes32) {
        return ERC4972Storage.getName();
    }

    /** INameValidator */

    function validate(
        bytes32 message,
        bytes memory signature
    ) external view override returns(uint256) {
        (bytes32 nameType, bytes32 name) = getName();
        bytes32 toSignHash = keccak256(abi.encode(nameType, name, message));
        address signer = toSignHash.toEthSignedMessageHash().recover(signature);
        return signer == validator ? 0 : 1;
    }
}