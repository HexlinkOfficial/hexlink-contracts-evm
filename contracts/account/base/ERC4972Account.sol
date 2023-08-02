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
    using SignatureChecker for address;

    event NameUpdated(bytes32 indexed name);
    event NameOwnerUpdated(address indexed);

    error InvalidNameOwner(address owner);

    IERC4972Registry immutable internal registry_;

    modifier onlyValidNameOwner() {
        address owner = ERC4972AccountStorage.layout().owner;
        if (!_isOwner(owner)) {
            revert InvalidNameOwner(owner);
        }
        _;
    }

    constructor(address registry) {
        registry_ = IERC4972Registry(registry);
    }

    function _ERC4972Account_init(bytes32 name, address owner) internal {
        ERC4972AccountStorage.layout().name = name;
        ERC4972AccountStorage.layout().owner = owner;
    }

    function getERC4972Registry() public view override returns(IERC4972Registry) {
        return registry_;
    }

    function getName() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().name;
    }

    function getNameOwner() public view returns(address) {
        return ERC4972AccountStorage.layout().owner;
    }

    function setNameOwner(address owner) external onlySelf {
        if (!_isOwner(owner)) {
            revert InvalidNameOwner(owner);
        }
        ERC4972AccountStorage.layout().owner = owner;
        emit NameOwnerUpdated(owner);
    }

    function setNameOwnerPublic(address newOwner) public {
        address owner = ERC4972AccountStorage.layout().owner;
        if (owner == newOwner || _isOwner(owner)) {
            return; // no need to update
        }
        if (owner == address(0) || !_isOwner(newOwner)) {
            revert InvalidNameOwner(newOwner);
        }
        ERC4972AccountStorage.layout().owner = newOwner;
        emit NameOwnerUpdated(owner);
    }

    function setName(bytes32 name) external onlySelf {
        ERC4972AccountStorage.layout().name = name;
        emit NameUpdated(name);
    }

    function _isOwner(address owner) internal view returns(bool) {
        return getERC4972Registry().getNameService().isOwner(getName(), owner);
    }

    function _validateNameOwner(
        bytes32 message,
        bytes memory signature
    ) internal returns(bool) {
        message = keccak256(abi.encodePacked(getName(), message));
        address signer = ECDSA.recover(message, signature);
        address owner = ERC4972AccountStorage.layout().owner;
        if (owner == address(0)) {
            ERC4972AccountStorage.layout().owner = signer;
        }
        return signer == owner;
    }
}