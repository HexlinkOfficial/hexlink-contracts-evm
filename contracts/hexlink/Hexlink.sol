// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/IAccountFactory.sol";
import "../interfaces/INameService.sol";
import "../interfaces/IERC6662.sol";
import "../account/Account.sol";
import "../utils/HexlinkERC1967Proxy.sol";
import "../utils/EntryPointStaker.sol";

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.Hexlink');

    struct Layout {
        address accountImpl;
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
    IERC6662,
    Initializable,
    EntryPointStaker,
    UUPSUpgradeable
{
    event AccountDeployed(
        bytes32 indexed name,
        address indexed account
    );

    INameService immutable nameService;
    IAuthRegistry immutable authRegistry;

    constructor(
        address nameService_,
        address authRegistry_
    ) {
        nameService = INameService(nameService_);
        authRegistry = IAuthRegistry(authRegistry_);
    }

    function initialize(address owner, address accountImpl) public initializer {
        _transferOwnership(owner);
        HexlinkStorage.layout().accountImpl = accountImpl;
    }

    /** IAccountFactory */

    function getAccountImplementation() public view override returns(address) {
        return HexlinkStorage.layout().accountImpl;
    }

    function setAccountImplementation(address impl) external onlyOwner {
        HexlinkStorage.layout().accountImpl = impl;
    }

    /** IERC4972Registry */

    function getOwnedAccount(bytes32 name) public view override returns(address) {
        return Clones.predictDeterministicAddress(address(this), name);
    }

    function getNameService() public view override returns(INameService) {
        return nameService;
    }

    function getAuthRegistry() public view override returns(IAuthRegistry) {
        return authRegistry;
    }

    /** IAccountFactory */

    function deploy(bytes32 name) external override returns(address account) {
        account = Clones.cloneDeterministic(address(this), name);
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            name,
            nameService.defaultOwner()
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