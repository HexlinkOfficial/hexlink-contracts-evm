// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "../../../hexlink/IAccountFactory.sol";
import "./AuthProviderBase.sol";
import "../../../utils/Constants.sol";

contract SimpleAuthProvider is AuthProviderBase {
    mapping(bytes32 => mapping(bytes32 => address)) internal validators;

    IAccountFactory immutable hexlink;

    constructor(address hexlink_) {
        hexlink = IAccountFactory(hexlink_);
    }

    function setValidator(
        bytes32 nameType,
        bytes32 name,
        address validator
    ) external {
        address ownedAccount = hexlink.ownedAccount(nameType, name);
        require(msg.sender == ownedAccount, "invalid caller");
        validators[nameType][name] = validator;
    }

    function isSupportedNameType(
        bytes32 nameType
    ) public pure override returns(bool) {
        return nameType != ENS_NAME;
    }

    function isValidSigner(
        bytes32 name,
        bytes32 nameType,
        address signer
    ) public view override returns(bool) {
        return validators[nameType][name] == signer;
    }
}