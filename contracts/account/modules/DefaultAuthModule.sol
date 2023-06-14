// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IAuthModule.sol";

contract DefaultAuthModule is IAuthModule {
    using ECDSA for bytes32;

    struct Name {
        bytes32 nameType;
        bytes32 name;
    }
    mapping(address => Name) internal registry;
    address public immutable validator;

    constructor(address validator_) {
        validator = validator_;
    }

    function setName(bytes32 nameType, bytes32 name) external {
        registry[msg.sender].nameType = nameType;
        registry[msg.sender].name = name;
    }

    function getName() public view returns(Name memory) {
        return registry[msg.sender];
    }

    /** INameValidator */

    function validate(
        bytes32 message,
        bytes memory signature
    ) external view override returns(uint256) {
        Name memory name = getName();
        bytes32 toSignHash = keccak256(abi.encode(name.nameType, name.name, message));
        address signer = toSignHash.toEthSignedMessageHash().recover(signature);
        return signer == validator ? 0 : 1;
    }
}