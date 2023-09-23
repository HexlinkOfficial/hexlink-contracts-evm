// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/INamespaceRegistry.sol";

contract NamespaceRegistry is INamespaceRegistry, Ownable, UUPSUpgradeable {
    struct Record {
        address owner;
        address registry;
    }

    mapping(bytes32 => Record) private records;

    modifier authorised(bytes32 ns) {
        address nsOwner = records[ns].owner;
        if (nsOwner == address(0)) {
            require(msg.sender == owner());
        } else {
            require(msg.sender == nsOwner);
        }
        _;
    }

    constructor(address owner) {
        _transferOwnership(owner);
    }

    /**
     * @dev Sets the record for a namespace.
     * @param ns The namespace update.
     * @param owner The address of the new owner.
     * @param registry The address of the name service registry.
     */
    function setNamespace(
        bytes32 ns,
        address owner,
        address registry
    ) external authorised(ns) virtual override {
        setOwner(ns, owner);
        setRegistry(ns, registry);
    }

    /**
     * @dev Sets the owner for a namespace.
     * @param ns The namespace to update.
     * @param owner The address of the new owner.
     */
    function setOwner(
        bytes32 ns,
        address owner
    ) public virtual override authorised(ns) {
        records[ns].owner = owner;
        emit NewOwner(ns, owner);
    }

    /**
     * @dev Sets the resolver for a namespace.
     * @param ns The namespace to update.
     * @param registry The registry of the namespace.
     */
    function setRegistry(
        bytes32 ns,
        address registry
    ) public virtual override authorised(ns) {
        records[ns].registry = registry;
        emit NewRegistry(ns, registry);
    }

    /**
     * @dev Returns the address that owns the specified node.
     * @param ns The specified namespace.
     * @return address of the owner.
     */
    function getOwner(
        bytes32 ns
    ) public view virtual override returns (address) {
        address addr = records[ns].owner;
        if (addr == address(this)) {
            return address(0x0);
        }
        return addr;
    }

    /**
     * @dev Returns the address of the resolver for the specified namepsace.
     * @param ns The specified namespace.
     * @return address of the resolver.
     */
    function getRegistry(
        bytes32 ns
    ) public view virtual override returns (address) {
        return records[ns].registry;
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }
}