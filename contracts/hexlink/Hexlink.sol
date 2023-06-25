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

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.main');

    struct Layout {
        address accountImplementation;
        mapping(bytes32 => address) providers;
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

    function setAuthProviders(
        bytes32[] memory nameTypes,
        address[] memory providers
    ) external onlyOwner {
        require(providers.length == nameTypes.length, "array length mismatch");
        for (uint256 i = 0; i < providers.length; i++) {
            HexlinkStorage.layout().providers[nameTypes[i]] = providers[i];
        }
    }

    function getAuthProvider(
        bytes32 nameType
    ) public view override returns(address) {
        return HexlinkStorage.layout().providers[nameType];
    }

    function setAccountImplementation(address impl) external onlyOwner {
        HexlinkStorage.layout().accountImplementation = impl;
    }

    function getAccountImplementation() public view override returns(address) {
        return HexlinkStorage.layout().accountImplementation;
    }

    /** IERC4972 */
 
    function ownedAccount(
        bytes32 nameType,
        bytes32 name
    ) public view override returns(address) {
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
        account = ownedAccount(nameType, name);
        address provider = getAuthProvider(nameType);
        require(provider != address(0), "unsupported name type");
        AuthProvider memory authProvider = AuthProvider(provider, 0);
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            AuthFactor(nameType, name, authProvider)
        );
        address impl = getAccountImplementation();
        IHexlinkERC1967Proxy(account).initProxy(impl, data);
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