// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/IAccountFactory.sol";
import "../interfaces/INameService.sol";
import "../account/Account.sol";
import "../utils/HexlinkERC1967Proxy.sol";
import "../utils/EntryPointStaker.sol";

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.Hexlink');

    struct Layout {
        address accountImpl;
        INameService nameService;
        address validator;
        IAuthRegistry authRegistry;
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
    IERC4972Registry,
    INameService,
    Initializable,
    EntryPointStaker,
    UUPSUpgradeable
{
    event AccountDeployed(
        bytes32 indexed name,
        address indexed account
    );

    address immutable erc1967Proxy;

    constructor(address erc1967Proxy_) {
        erc1967Proxy = erc1967Proxy_;
    }

    function initialize(
        address owner,
        address validator,
        address nameService,
        address authRegistry
    ) public initializer {
        _transferOwnership(owner);
        HexlinkStorage.layout().validator = validator;
        HexlinkStorage.layout().nameService = INameService(nameService);
        HexlinkStorage.layout().authRegistry = IAuthRegistry(authRegistry);
    }

    /** INameService */

    function isOwner(
        bytes32 /* name */,
        address owner
    ) external view override returns(bool) {
        address validator = HexlinkStorage.layout().validator;
        return owner == validator;
    }

    /** IAccountFactory */

    function getDefaultValidator() public view override returns(address) {
        INameService ns = HexlinkStorage.layout().nameService;
        if (address(ns) == address(0)) {
            return HexlinkStorage.layout().validator;
        } else {
            return address(0);
        }
    }

    function setDefaultValidator(address validator) external onlyOwner {
        HexlinkStorage.layout().validator = validator;
    }

    function getAccountImplementation() public view override returns(address) {
        return HexlinkStorage.layout().accountImpl;
    }

    function setAccountImplementation(address impl) external onlyOwner {
        HexlinkStorage.layout().accountImpl = impl;
    }

    /** IERC4972Registry */

    function setNameService(address nameService) external onlyOwner {
        HexlinkStorage.layout().nameService = INameService(nameService);
    }

    function getNameService() public view override returns(INameService) {
        INameService ns = HexlinkStorage.layout().nameService;
        if (address(ns) == address(0)) {
            return INameService(address(this));
        } else {
            return ns;
        }
    }

    function getAuthRegistry() public view override returns(IAuthRegistry) {
        return HexlinkStorage.layout().authRegistry;
    }
 
    function getOwnedAccount(bytes32 name) public view override returns(address) {
        return Clones.predictDeterministicAddress(address(this), name);
    }

    /** IAccountFactory */

    function deploy(bytes32 name) external override returns(address account) {
        account = Clones.cloneDeterministic(erc1967Proxy, name);
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            getDefaultValidator()
        );
        address impl = getAccountImplementation();
        HexlinkERC1967Proxy(payable(account)).initProxy(impl, data);
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