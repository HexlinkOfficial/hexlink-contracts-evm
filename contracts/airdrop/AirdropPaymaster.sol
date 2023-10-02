// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import "../interfaces/IAccountFactory.sol";
import "../airdrop/Airdrop.sol";
import "hardhat/console.sol";

contract AirdropPaymaster is BasePaymaster {
    error NotFromHexlinkAccount();
    error NotHexlinkExcutionFunction();
    error NotClaimingAirdrop();

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;
    uint256 private constant SIGNATURE_OFFSET = 84;
    IAccountFactory public immutable hexlink;
    address public immutable airdrop;

    constructor(
        IEntryPoint _entryPoint,
        address _hexlink,
        address _airdrop,
        address owner
    ) BasePaymaster(_entryPoint) {
        hexlink = IAccountFactory(_hexlink);
        airdrop = _airdrop;
        _transferOwnership(owner);
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* requiredPreFund */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        bytes32 name = bytes32(userOp.paymasterAndData[20:52]);
        address account = hexlink.getAccountAddress(name);
        if (userOp.sender != account) {
            revert NotFromHexlinkAccount();
        }
        if (SimpleAccount.execute.selector != bytes4(userOp.callData[0:4])) {
            revert NotHexlinkExcutionFunction();
        }
        // target of execute
        if (address(uint160(uint256(bytes32(userOp.callData[4:36])))) != airdrop) {
            revert NotClaimingAirdrop();
        }
        // value of execute
        if (uint256(bytes32(userOp.callData[36:68])) != 0) {
            revert NotClaimingAirdrop();
        }
        // skip the location and length of claim calldata(bytes64)
        // claim function of airdrop
        if (bytes4(userOp.callData[132:136]) != Airdrop.claim.selector) {
            revert NotClaimingAirdrop();
        }
        return ("", _packValidationData(false, 0, 0));
    }
}