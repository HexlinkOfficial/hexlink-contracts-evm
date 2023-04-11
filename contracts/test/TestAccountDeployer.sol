//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract TestAccountDeployer {
    using Address for address;

    event Deploy(address indexed account);

    address private base_;

    constructor(address base) {
        base_ = base;
    }

    function deploy(bytes32 name, bytes calldata data) external {
        address account = Clones.cloneDeterministic(base_, name);
        account.functionCall(data);
        emit Deploy(account);
    }

    function addressOfName(bytes32 name) external view returns (address) {
        return Clones.predictDeterministicAddress(base_, name);
    }
}