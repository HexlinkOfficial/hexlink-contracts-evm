// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./interfaces/IAccountFactory.sol";
import "./interfaces/INameService.sol";
import "./account/Account.sol";
import "./utils/HexlinkERC1967Proxy.sol";
import "./utils/EntryPointStaker.sol";

struct NameRecord {
    address accountImpl;
    address defaultValidator;
}

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.Hexlink');

    struct Layout {
        mapping(address => NameRecord) names;
    }

    function setDefaultValidator(
        address nameService,
        address validator
    ) internal {
        layout().names[nameService].defaultValidator = validator;
    }

    function setAccountImplementation(
        address nameService,
        address impl
    ) internal {
        layout().names[nameService].accountImpl = impl;
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
    Initializable,
    EntryPointStaker,
    UUPSUpgradeable
{
    event AccountDeployed(
        address indexed nameService,
        bytes32 indexed name,
        address indexed account
    );
    event DefaultValidatorSet(
        address indexed nameService,
        address indexed validator
    );

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /** Default Auth Provider */

    function setDefaultValidator(
        address nameService,
        address validator
    ) external onlyOwner {
        HexlinkStorage.setDefaultValidator(nameService, validator);
        emit DefaultValidatorSet(nameService, validator);
    }

    function getDefaultValidator(
        address nameService
    ) public view returns(address) {
        return HexlinkStorage.layout().names[nameService].defaultValidator;
    }

    /* Account Implementation */

    function setAccountImplementation(
        address nameService,
        address impl
    ) external onlyOwner {
        HexlinkStorage.setAccountImplementation(nameService, impl);
    }

    function getAccountImplementation(
        address nameService
    ) public view override returns(address) {
        return HexlinkStorage.layout().names[nameService].accountImpl;
    }

    /** IERC4972 */
 
    function getOwnedAccount(
        address nameService,
        bytes32 name
    ) public view override returns(address) {
        return Clones.predictDeterministicAddress(
            address(this),
            _nameHash(nameService, name)
        );
    }

    /** IAccountFactory */

    function deploy(
        address nameService,
        bytes32 name
    ) external override returns(address account) {
        account = Clones.cloneDeterministic(
            address(this),
            _nameHash(nameService, name)
        );
        address validator = getDefaultValidator(nameService);
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            name,
            validator
        );
        address impl = getAccountImplementation(nameService);
        HexlinkERC1967Proxy(payable(account)).initProxy(impl, data);
        emit AccountDeployed(nameService, name, account);
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }

    /** utils */

    function _nameHash(
        address nameService,
        bytes32 name
    ) internal pure returns(bytes32) {
        return keccak256(abi.encode(nameService, name));
    }
}