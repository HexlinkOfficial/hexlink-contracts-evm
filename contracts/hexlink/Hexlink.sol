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

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.main');

    struct Layout {
        mapping(bytes32 => address) providers;
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
    IERC4972,
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

    address public immutable accountBase;


    constructor(address accountBase_) {
        accountBase = accountBase_;
    }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /** Default Auth Provider */

    function setDefaultAuthProviders(address[] memory providers) external onlyOwner {
        mapping(bytes32 => address) storage defaultProviders =
            HexlinkStorage.layout().providers;
        for (uint256 i = 0; i < providers.length; i++) {
            address provider = providers[i];
            bytes32 nameType = IAuthProvider(provider).getNameType();
            defaultProviders[nameType] = provider;
        }
    }

    function getDefaultProvider(bytes32 nameType) public view returns(address) {
        return HexlinkStorage.layout().providers[nameType];
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

    function updateOwnedAccount(
        bytes32 nameType1,
        bytes32 name1,
        bytes32 nameType2,
        bytes32 name2
    ) external {
        _validateNameType(nameType1);
        _validateNameType(nameType2);
        require(ownedAccount(nameType1, name1) == msg.sender, "invalid caller");
        address account = ownedAccount(nameType2, name2);
        HexlinkStorage.layout().accounts[nameType1][name1] = account;
        emit AccountUpdated(nameType1, name1, account);
    }

    /** IAccountFactory */

    function deploy(
        bytes32 nameType,
        bytes32 name
    ) external override returns(address account) {
        _validateNameType(nameType);
        account = ownedAccount(nameType, name);
        address provider = getDefaultProvider(nameType);
        require(provider != address(0), "name type not supported");
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            provider,
            name
        );
        IHexlinkERC1967Proxy(account).initProxy(accountBase, data);
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

    function _validateNameType(bytes32 nameType) internal view {
        address provider = HexlinkStorage.layout().providers[nameType];
        require(provider != address(0), "unsupported name type");
    }
}