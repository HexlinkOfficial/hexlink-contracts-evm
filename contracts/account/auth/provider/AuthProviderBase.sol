// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "./IAuthProvider.sol";
import "../../structs.sol";
import "../../../utils/Constants.sol";

abstract contract AuthProviderBase is IAuthProvider, Constants {
    using SignatureChecker for address;

    function isSupportedNameType(
        bytes32 nameType
    ) public view virtual returns(bool);

    function isValidSigner(
        bytes32 name,
        bytes32 nameType,
        address signer
    ) public view virtual returns(bool);

    function validateSignature(
        bytes32 name,
        bytes32 nameType,
        bytes32 requestHash,
        address signer,
        bytes memory signature
    ) external view override returns(uint256) {
        if (!isSupportedNameType(nameType)) {
            return 1;
        }
        if (!isValidSigner(name, nameType, signer)) {
            return 2;
        }
        bytes32 message = keccak256(abi.encode(
            AuthFactor(name, nameType, address(this)),
            requestHash
        ));
        if (!signer.isValidSignatureNow(message, signature)) {
            return 2; // invalid signature
        }
        return 0;
    }
}