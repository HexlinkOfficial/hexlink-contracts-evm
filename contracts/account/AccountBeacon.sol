//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";

contract AccountBeacon is IBeacon, Ownable {
    event Upgraded(address indexed implementation);

    address private _implementation;

    function init(address newOwner, address newImplementation) external {
        require(owner() == address(0), "already initialized");
        _transferOwnership(newOwner);
        _setImplementation(newImplementation);
    }

    function implementation() public view virtual override returns (address) {
        return _implementation;
    }

    function upgradeTo(address newImplementation) public virtual onlyOwner {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function _setImplementation(address newImplementation) private {
        require(
            Address.isContract(newImplementation),
            "UpgradeableBeacon: implementation is not a contract"
        );
        _implementation = newImplementation;
    }
}