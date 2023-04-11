//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/**
    Do not update this file, this file is used
    to ensure the identical cross-chain addresses
*/

import "@solidstate/contracts/access/ownable/Ownable.sol";

contract ContractFactory is Ownable {
    constructor(address owner) {
        _transferOwnership(owner);
    }

    function deploy(bytes memory bytecode, uint salt) public payable onlyOwner {
        address addr;
        /*
        NOTE: How to call create2

        create2(v, p, n, s)
        create new contract with code at memory p to p + n
        and send v wei
        and return the new address
        where new address = first 20 bytes of keccak256(0xff + address(this) + s + keccak256(mem[p…(p+n)))
              s = big-endian 256-bit value
        */
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
    }

    function getAddress(
        bytes memory bytecode,
        uint salt
    ) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint(hash)));
    }
}