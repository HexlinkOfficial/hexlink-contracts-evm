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
        bytes32 nameType,
        bytes32 name,
        address signer
    ) public view virtual returns(bool);
}