// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IAuthModule.sol";
import "../../utils/EntryPointStaker.sol";

contract AuthModule is IAuthModule, EntryPointStaker {
    using ECDSA for bytes32;

    // keccak256("mailto");
    bytes32 public constant MAILTO = 0xa494cfc40d31c3891835fac394fbcdd0bf27978f8af488c9a97d9b406b1ad96e;
    // keccak256("tel");
    bytes32 public constant TEL = 0xeeef3d88e44720eeae328f3cead00ac0a41c6a29bad00b2cdf1b4cdb919afe81;

    struct NameInfo {
        bytes32 nameType;
        bytes32 name;
    }
    mapping(address => NameInfo) names;
    mapping(address => mapping(address => bool)) validators;
    address public immutable defaultEmailPhoneValidator;

    modifier onlySupportedNameType(bytes32 nameType) {
        require(nameType == MAILTO || nameType == TEL, "unsupported name type");
        _;
    }

    constructor(address defaultEmailPhoneValidator_) {
        defaultEmailPhoneValidator = defaultEmailPhoneValidator_;
    }

    function getNameInfo() public view returns(bytes32, bytes32) {
        return (names[msg.sender].nameType, names[msg.sender].name);
    }

    function setName(
        bytes32 nameType,
        bytes32 name
    ) onlySupportedNameType(nameType) external {
        names[msg.sender].nameType = nameType;
        names[msg.sender].name = name;
    }

    function setValidator(address validator, bool registered) external {
        validators[msg.sender][validator] = registered;
    }

    function validate(
        bytes32 message,
        bytes memory signature
    ) external view override returns(uint256) {
        (bytes32 nameType, bytes32 name) = getNameInfo();
        bytes32 signed = keccak256(abi.encode(nameType, name, message));
        address signer = signed.toEthSignedMessageHash().recover(signature);
        address defaultValidator = _defaultValidator(nameType);
        return (
            defaultValidator == signer || validators[msg.sender][signer]
        ) ? 0 : 1;
    }

    function _defaultValidator(
        bytes32 nameType
    ) onlySupportedNameType(nameType) internal view returns(address) {
        return defaultEmailPhoneValidator;
    }
}