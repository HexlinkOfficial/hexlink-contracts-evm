// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./IERC4972.sol";
import "./IAccountFactory.sol";
import "../utils/IHexlinkERC1967Proxy.sol";
import "../account/Account.sol";
import "../utils/EntryPointStaker.sol";

contract Hexlink is IAccountFactory, IERC4972, Initializable, EntryPointStaker, UUPSUpgradeable {
    event Deployed(
        bytes32 indexed nameType,
        bytes32 indexed name,
        address indexed account
    );

    address public immutable accountBase;
    address public immutable defaultAuthModule;

    constructor(
        address accountBase_,
        address authModule_
    ) {
        accountBase = accountBase_;
        defaultAuthModule = authModule_;
    }

    receive() external payable { }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /** IERC4972 */

    function ownedAccount(
        bytes32 nameType,
        bytes32 name
    ) external view override returns(address) {
        return Clones.predictDeterministicAddress(
            address(this),
            _nameHash(nameType, name)
        );
    }

    /** IAccountFactory */

    function deploy(
        bytes32 nameType,
        bytes32 name
    ) external override returns(address account) {
        account = Clones.cloneDeterministic(
            address(this),
            _nameHash(nameType, name)
        );
        bytes memory moduleData = abi.encodeWithSignature(
            "setName(bytes32,bytes32)",
            nameType,
            name
        );
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            defaultAuthModule,
            moduleData
        );
        IHexlinkERC1967Proxy(account).initProxy(accountBase, data);
        emit Deployed(nameType, name, account);
    }

    /** UUPSUpgradeable */

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }

    /** utils */

    function _nameHash(
        bytes32 nameType,
        bytes32 name
    ) internal pure returns(bytes32) {
        return keccak256(abi.encode(nameType, name));
    }
}