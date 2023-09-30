// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IAccountFactory.sol";
import "../interfaces/IAccountInitializer.sol";
import "../utils/HexlinkERC1967Proxy.sol";
import "../utils/EntryPointStaker.sol";

contract Hexlink is
    IAccountFactory,
    Initializable,
    EntryPointStaker,
    UUPSUpgradeable
{
    using ECDSA for bytes32;

    error NameValidationError(bytes32 name);

    event AccountDeployed(
        bytes32 indexed name,
        address indexed account
    );

    address immutable validator;
    address immutable accountImpl;

    constructor(address _validator, address _accountImpl) {
        validator = _validator;
        accountImpl = _accountImpl;
    }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    function getValidator() external view returns(address) {
        return validator;
    }

    /** IAccountFactory */

    function getAccountImplementation() public view override returns(address) {
        return accountImpl;
    }

    function getAccountAddress(bytes32 name) public view override returns(address) {
        return Clones.predictDeterministicAddress(address(this), name);
    }

    function deploy(
        bytes32 name,
        address owner,
        bytes memory proof
    ) external returns(address account) {
        bytes32 message = keccak256(
            abi.encodePacked(block.chainid, address(this), owner)
        );
        message = keccak256(abi.encodePacked(name, message));
        if (message.toEthSignedMessageHash().recover(proof) != validator) {
            revert NameValidationError(name);
        }
        account = Clones.cloneDeterministic(address(this), name);        
        bytes memory data = abi.encodeWithSelector(
            IAccountInitializer.initialize.selector,
            owner
        );
        HexlinkERC1967Proxy(payable(account)).initProxy(accountImpl, data);
        emit AccountDeployed(name, account);
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }
}