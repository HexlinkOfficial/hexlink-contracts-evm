//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/utils/Address.sol";
import "@solidstate/contracts/access/ownable/Ownable.sol";
import "./ContractDeployer.sol";

contract HexlinkContractFactory is ContractDeployer, Ownable {
    using Address for address;

    constructor(address owner) {
        _transferOwnership(owner);
    }

    function deployAndCall(
        bytes memory bytecode,
        bytes32 salt,
        bytes memory data
    ) public payable onlyOwner {
        _deployAndCall(bytecode, salt, data);
    }

    function getAddress(
        bytes memory bytecode,
        bytes32 salt
    ) external view returns(address) {
        return _getAddress(bytecode, salt);
    }
}