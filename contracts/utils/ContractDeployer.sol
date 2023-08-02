//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@openzeppelin/contracts/utils/Address.sol";

abstract contract ContractDeployer {
    using Address for address;

    function _deployAndCall(
        bytes memory bytecode,
        bytes32 salt,
        bytes memory data
    ) internal returns(address addr) {
        assembly {
            addr := create2(
                callvalue(), // wei sent with current call
                // Actual code starts after skipping the first 32 bytes
                add(bytecode, 0x20),
                mload(bytecode), // Load the size of code contained in the first 32 bytes
                salt // Salt from function arguments
            )
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        if (data.length > 0) {
            addr.functionCall(data);
        }
    }

    function _getAddress(
        bytes memory bytecode,
        bytes32 salt
    ) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint(hash)));
    }
}