// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./INamespaceRegistry.sol";

contract NamespaceRegistry is INamespaceRegistry, Ownable {
    struct Record {
        address owner;
        address registry;
    }

    error NotAuthorised(bytes32 node, address sender, address owner);

    mapping(bytes32 => Record) private records;

    modifier authorised(bytes32 node) {
        address nodeOwner = records[node].owner;
        if (nodeOwner == address(0)) { // not registered
            address nsOwner = owner();
            if (msg.sender != nsOwner) {
                revert NotAuthorised(node, msg.sender, nsOwner);
            }
        } else { // registered
            if (msg.sender != nodeOwner) {
                revert NotAuthorised(node, msg.sender, nodeOwner);
            }
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
    ) external virtual override {
        setOwner(ns, owner);
        _setRegistry(ns, registry);
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
        _setRegistry(ns, registry);
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

    function _setRegistry(
        bytes32 ns,
        address registry
    ) private {
        records[ns].registry = registry;
        emit NewRegistry(ns, registry);
    }
}
