//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../interfaces/IAccountFactory.sol";
import "../../interfaces/IERC4972Account.sol";
import "../../interfaces/INameService.sol";
import "./AccountAuthBase.sol";

library ERC4972AccountStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.erc4972');
 
    struct Layout {
        bytes32 name;
        address owner;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract ERC4972Account is IERC4972Account, AccountAuthBase {
    using ECDSA for bytes32;

    event NameUpdated(bytes32 indexed name);
    event NameOwnerUpdated(address indexed);

    error InvalidNameToSet(bytes32 name);
    error InvalidNameOwner(address owner);

    modifier onlyValidNameOwner() {
        if (!setNameOwner()) {
            _;
        }
    }

    function _ERC4972Account_init(bytes32 name, address owner) internal {
        ERC4972AccountStorage.layout().name = name;
        ERC4972AccountStorage.layout().owner = owner;
    }

    function getERC4972Registry() public view override returns(IERC4972Registry) {
        return IERC4972Registry(hexlink_);
    }

    function getName() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().name;
    }

    function getNameOwner() public view returns(address) {
        return ERC4972AccountStorage.layout().owner;
    }

    function setNameOwner() public returns(bool updated) {
        address owner = IERC4972Registry(hexlink_).getNameService().owner(getName());
        if (owner == ERC4972AccountStorage.layout().owner) {
            return false;
        }
        ERC4972AccountStorage.layout().owner = owner;
        emit NameOwnerUpdated(owner);
        return true;
    }

    function setName(bytes32 name) external onlySelf {
        if (IERC4972Registry(hexlink_).getOwnedAccount(name) != address(this)) {
            revert InvalidNameToSet(name);
        }
        ERC4972AccountStorage.layout().name = name;
        emit NameUpdated(name);
    }

    function _validateNameOwner(
        bytes32 message,
        bytes memory signature
    ) internal returns(bool) {
        address signer = ECDSA.recover(message.toEthSignedMessageHash(), signature);
        address owner = ERC4972AccountStorage.layout().owner;
        if (owner == address(0)) {
            ERC4972AccountStorage.layout().owner = signer;
        }
        return signer == owner;
    }
}