// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../account/IHexlinkAccount.sol";
import "./IHexlink.sol";
import "../registry/INameRegistry.sol";
import "../registry/RegistryStorage.sol";

contract Hexlink is IHexlink, Ownable, UUPSUpgradeable {
    using Address for address;

    event Registered(bytes32 schema, bytes32 domain, address registry);
    event Deployed(bytes32 indexed name, address indexed account);

    address public immutable accountImplementation;

    constructor(address accountImplementation_) {
        accountImplementation = accountImplementation_;
    }

    function init(
        address owner,
        address[] memory registries
    ) external {
        require(_owner() == address(0) && owner != address(0), "invalid init owner");
        _transferOwnership(owner);
        for (uint i = 0; i < registries.length; i++) {
            INameRegistry registry = INameRegistry(registries[i]);
            RegistryStorage.register(
                registry.getSchema(),
                registry.getDomain(),
                registries[i]
            );
        }
    }

    /** EIP-4972 Functions */

    function ownedAccount(
        bytes32 name
    ) external view override returns(address) {
        return Clones.predictDeterministicAddress(
            accountImplementation,
            name
        );
    }

    /** IAccountFactory Functions */

    function deploy(
        Name calldata name,
        address owner,
        bytes calldata authProof
    ) external override returns(address account) {
        address registry = getRegistry(name.schema, name.domain);
        require(registry != address(0), "registry not found");

        bytes32 requestId = keccak256(
            abi.encode(msg.sig, address(this), block.chainid, owner)
        );
        bytes32 nameHash = _encodeName(name);
        uint256 validationData = INameRegistry(
            registry
        ).validateName(nameHash, requestId, authProof);
        require(
            validationData == 0,
            string.concat("name validation error ", Strings.toString(validationData))
        );

        account = Clones.cloneDeterministic(accountImplementation, nameHash);
        IHexlinkAccount(account).init(owner, nameHash, registry);
        emit Deployed(nameHash, account);
    }

    /** name registry functions */

    function setRegistry(address registry) external onlyOwner {
        INameRegistry nr = INameRegistry(registry);
        bytes32 schema = nr.getSchema();
        bytes32 domain = nr.getDomain();
        RegistryStorage.register(schema, domain, registry);
        emit Registered(schema, domain, registry);
    }

    function getRegistry(bytes32 schema, bytes32 domain) public view returns(address) {
        return RegistryStorage.getRegistry(schema, domain);
    }

    function _encodeName(Name calldata name) internal pure returns(bytes32) {
        return keccak256(abi.encode(name.schema, name.domain, name.handle));
    }

    /** UUPSUpgradeable Functions */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }
}