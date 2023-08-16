// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/IAccountInitializer.sol";
import "../interfaces/IAccountFactory.sol";
import "../interfaces/INameService.sol";
import "../interfaces/IERC4972Registry.sol";
import "../interfaces/IERC6662.sol";
import "../interfaces/IVersionManager.sol";
import "../interfaces/IVersion.sol";
import "../utils/HexlinkERC1967Proxy.sol";
import "../utils/EntryPointStaker.sol";

library HexlinkStorage {
    bytes32 internal constant STORAGE_SLOT = keccak256('hexlink.Hexlink');

    struct Layout {
        address accountImpl; // deprecated
        IAuthRegistry authRegistry;
        mapping(uint256 => address) accountImpls;
        uint256 currentVersion;
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
    IVersionManager,
    IERC4972Registry,
    IERC6662,
    Initializable,
    EntryPointStaker,
    UUPSUpgradeable
{
    error InvalidAccountVersion(uint256 current, uint256 next);
    error InvalidVersionRange(uint256 start, uint256 end);

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
        _upgradeImplementation(accountImpl);
    }

    /** IVersionManager */

    function getLatestVersion() public view override returns(uint256) {
        return HexlinkStorage.layout().currentVersion;
    }

    function getImplementation(uint256 version) public view override returns(address) {
        return HexlinkStorage.layout().accountImpls[version];
    }

    function getImplementations(uint256 start, uint256 end)
        external
        view
        returns(address[] memory)
    {
        uint256 current = HexlinkStorage.layout().currentVersion;
        if (start > end || start < 1 || end > current) {
            revert InvalidVersionRange(start, end);
        }
        address[] memory result = new address[](end - start + 1);
        for (uint256 i = start; i <= end; i++) {
            result[i - start] = HexlinkStorage.layout().accountImpls[i];
        }
        return result;
    }

    function upgradeImplementation(address impl) external onlyOwner {
        _upgradeImplementation(impl);
    }

    function _upgradeImplementation(address impl) internal {
        uint256 next = IVersion(impl).version();
        uint256 current = HexlinkStorage.layout().currentVersion;
        if (next != current + 1) {
            revert InvalidAccountVersion(current, next);
        }
        HexlinkStorage.layout().accountImpls[next] = impl;
        HexlinkStorage.layout().currentVersion = next;
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

    function getAccountImplementation() public view override returns(address) {
        return getImplementation(getLatestVersion());
    }

    function deploy(bytes32 name) external override returns(address account) {
        account = Clones.cloneDeterministic(address(this), name);
        bytes memory data = abi.encodeWithSelector(
            IAccountInitializer.initialize.selector,
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