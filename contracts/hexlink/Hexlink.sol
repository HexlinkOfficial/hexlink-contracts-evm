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
import "../utils/Constants.sol";
import "./IAccountFactory.sol";

struct NameInfo {
    address impl;
    address provider;
}

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.main');

    struct Layout {
        mapping(bytes32 => NameInfo) info;
        mapping(bytes32 => mapping(bytes32 => address)) accounts;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract Hexlink is
    IAccountFactory,
    Constants,
    Initializable,
    EntryPointStaker,
    UUPSUpgradeable
{
    event AccountDeployed(
        bytes32 indexed nameType,
        bytes32 indexed name,
        address indexed account
    );
    event AccountUpdated(
        bytes32 indexed nameType,
        bytes32 indexed name,
        address indexed account
    );

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /** Default Auth Provider */

    function setNameInfo(
        address[] memory providers,
        address[] memory impls
    ) external onlyOwner {
        require(providers.length == impls.length, "array length mismatch");
        mapping(bytes32 => NameInfo) storage info =
            HexlinkStorage.layout().info;
        for (uint256 i = 0; i < providers.length; i++) {
            address provider = providers[i];
            bytes32 nameType = IAuthProvider(provider).getNameType();
            info[nameType] = NameInfo(provider, impls[i]);
        }
    }

    function getNameInfo(bytes32 nameType) public view returns(NameInfo memory) {
        return HexlinkStorage.layout().info[nameType];
    }

    function getAccountImplementation(
        bytes32 nameType
    ) public view override returns(address) {
        return HexlinkStorage.layout().info[nameType].impl;
    }

    /** IERC4972 */
 
    function ownedAccount(
        bytes32 nameType,
        bytes32 name
    ) public view override returns(address) {
        address account = HexlinkStorage.layout().accounts[nameType][name];
        if (account == address(0)) {
            return Clones.predictDeterministicAddress(
                address(this),
                _nameHash(nameType, name)
            );
        } else {
            return account;
        }
    }

    /** IAccountFactory */

    function deploy(
        bytes32 nameType,
        bytes32 name
    ) external override returns(address account) {
        account = ownedAccount(nameType, name);
        NameInfo memory info = getNameInfo(nameType);
        require(
            info.provider != address(0) && info.impl != address(0),
            "name type not supported"
        );
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            info.provider,
            name
        );
        IHexlinkERC1967Proxy(account).initProxy(info.impl, data);
        emit AccountDeployed(nameType, name, account);
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