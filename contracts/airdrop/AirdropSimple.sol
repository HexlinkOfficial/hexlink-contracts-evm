// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AirdropSimple is Ownable, Pausable {
    using ECDSA for bytes32;

    error NotAuthorized();
    error NotCalledFromClaimer();
    error AlreadyClaimed();

    event Claim(
        address indexed claimer,
        uint256 amount
    );

    address immutable token;
    address immutable validator;
    mapping(address => bool) internal claimed;

    constructor(address _token, address _validator) {
        token = _token;
        validator = _validator;
    }

    function withdraw(address to, uint256 amount) onlyOwner external {
        _transfer(to, amount);
    }

    function pause() onlyOwner external {
        _pause();
    }

    function unpause() onlyOwner external {
        _unpause();
    }

    /* claim */

    function claim(
        address claimer,
        address beneficiary,
        uint256 amount,
        bytes memory proof
    ) external whenNotPaused {
        if (msg.sender != claimer) {
            revert NotCalledFromClaimer();
        }
        if (hasClaimed(msg.sender)) {
            revert AlreadyClaimed();
        }
        claimed[msg.sender] = true;
        bytes32 message = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                claimer,
                beneficiary,
                amount
            )
        );
        if (message.toEthSignedMessageHash().recover(proof) != validator) {
            revert NotAuthorized();
        }
        _transfer(beneficiary, amount);
        emit Claim(claimer, amount);
    }

    function hasClaimed(address claimer) public view returns(bool) {
        return claimed[claimer];
    }

    function _transfer(address to, uint256 amount) internal {
        if (token == address(0)) {
            Address.sendValue(payable(to), amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}