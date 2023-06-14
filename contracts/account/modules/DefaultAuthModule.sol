// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IAuthModule.sol";

library ERC4972Storage {
    struct Layout {
        bytes32 nameType;
        bytes32 name;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.storage.erc4972');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract DefaultAuthModule is IAuthModule {
    using ECDSA for bytes32;

    address public immutable validator;

    constructor(address validator_) {
        validator = validator_;
    }

    function setName(bytes32 nameType, bytes32 name) external {
        ERC4972Storage.Layout storage s = ERC4972Storage.layout();
        s.nameType = nameType;
        s.name = name;
    }

    function getName() public pure returns(bytes32, bytes32) {
        ERC4972Storage.Layout memory s = ERC4972Storage.layout();
        return (s.nameType, s.name);
    }

    /** INameValidator */

    function validate(
        bytes32 message,
        bytes memory signature
    ) external view override returns(uint256) {
        (bytes32 nameType, bytes32 name) = getName();
        bytes32 toSignHash = keccak256(abi.encode(nameType, name, message));
        address signer = toSignHash.toEthSignedMessageHash().recover(signature);
        return signer == validator ? 0 : 1;
    }
}