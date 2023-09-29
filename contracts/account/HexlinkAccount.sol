//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IAccountFactory.sol";
import "./base/Simple2FA.sol";

contract HexlinkAccount is
    SimpleAccount,
    Simple2FA
{
    using ECDSA for bytes32;

    error InvalidAccountImplementation();
    error InvalidSignType(uint8);

    constructor(
        address entryPoint,
        address hexlink
    ) SimpleAccount(IEntryPoint(entryPoint))
      AccountAuthBase(hexlink) {}

    /* ERC4337 */

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        uint8 signType = uint8(userOp.signature[0]);
        if(signType != 0x00) {
            revert InvalidSignType(signType);
        }
        uint96 timeRange = uint96(bytes12(userOp.signature[1:13]));
        bytes32 message = keccak256(abi.encodePacked(signType, timeRange, userOpHash));
        bool valid = _validateFirstFactor(message, userOp.signature[13:78]);
        if (valid && isSecondFactorEnabled()) {
            valid = valid && _validateSecondFactor(message, userOp.signature[78:143]);
        }
        return (uint256(timeRange) << 160) | (valid ? 0 : 1);
    }

    function _validateFirstFactor(
        bytes32 message,
        bytes memory signature
    ) internal view returns(bool) {
        return owner == message.toEthSignedMessageHash().recover(signature);
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }
}