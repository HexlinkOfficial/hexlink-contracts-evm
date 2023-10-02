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
    address public immutable hexlink;
    address public immutable airdrop;

    constructor(
        IEntryPoint _entryPoint,
        address _hexlink,
        address _airdrop,
        address owner
    ) BasePaymaster(_entryPoint) {
        hexlink = _hexlink;
        airdrop = _airdrop;
        _transferOwnership(owner);
    }

    function getHexlinkAccount(
        bytes32 salt
    ) public view returns (address account) {
        address impl = hexlink;
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(add(ptr, 0x38), impl)
            mstore(add(ptr, 0x24), 0x5af43d82803e903d91602b57fd5bf3ff)
            mstore(add(ptr, 0x14), impl)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73)
            mstore(add(ptr, 0x58), salt)
            mstore(add(ptr, 0x78), keccak256(add(ptr, 0x0c), 0x37))
            account := keccak256(add(ptr, 0x43), 0x55)
        }
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* requiredPreFund */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        bytes32 name = bytes32(userOp.paymasterAndData[20:52]);
        address account = getHexlinkAccount(name);
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