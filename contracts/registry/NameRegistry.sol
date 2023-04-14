// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./INameRegistry.sol";

contract NameRegistry is Ownable, INameRegistry {
    using ECDSA for bytes32;

    event Registered(
        address indexed validator,
        bool registered
    );

    uint256 constant internal SIG_VALIDATION_SUCCEED = 0;
    uint256 constant internal SIG_VALIDATION_FAILED_WITH_EXPIRED_PROOF = 1;
    uint256 constant internal SIG_VALIDATION_FAILED_WITH_INVALID_VALIDATOR = 2;
    uint256 constant internal SIG_VALIDATION_FAILED_WITH_INVALID_SIG = 3;

    bytes32 internal schema_;
    bytes32 internal domain_;
    mapping(address => bool) validators_;

    constructor(
        bytes32 schema,
        bytes32 domain,
        address owner,
        address[] memory validators
    ) {
        init(schema, domain, owner, validators);
    }

    /** INameRegistry */

    function getSchema() external view override returns(bytes32) {
        return schema_;
    }

    function getDomain() external view override returns(bytes32) {
        return domain_;
    }

    function validateName(
        bytes32 name,
        bytes32 requestInfo,
        bytes memory authProof
    ) external view override returns(uint256) {
        (
            uint256 expiredAt,
            address validator,
            bytes memory signature
        ) = abi.decode(authProof, (uint256, address, bytes));
        if (expiredAt <= block.timestamp) {
            return SIG_VALIDATION_FAILED_WITH_EXPIRED_PROOF;
        }
        if (!validators_[validator]) {
            return SIG_VALIDATION_FAILED_WITH_INVALID_VALIDATOR;
        }
        bytes32 message = keccak256(
            abi.encode(name, requestInfo, expiredAt, validator)
        );
        bytes32 messageHash = message.toEthSignedMessageHash();
        if (validator != messageHash.recover(signature)) {
            return SIG_VALIDATION_FAILED_WITH_INVALID_SIG;
        }
        return SIG_VALIDATION_SUCCEED;
    }

    /** validator registration */

    function isRegistered(address validator) external view returns (bool) {
        return validators_[validator];
    }

    function registerValidator(
        address validator,
        bool registered
    ) external onlyOwner {
        require(validator != address(0), "invalid validator");
        validators_[validator] = registered;
        emit Registered(validator, registered);
    }

    /** help functions to create name registry */

    function init(
        bytes32 schema,
        bytes32 domain,
        address owner,
        address[] memory validators
    ) public {
        require(_owner() == address(0), "HEXL015");
        _transferOwnership(owner);
        for (uint i = 0; i < validators.length; i++) {
            validators_[validators[i]] = true;
        }
        schema_ = schema;
        domain_ = domain;
    }
}