//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../interfaces/IAccountFactory.sol";

library ERC4972AccountStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.erc4972');
 
    struct Layout {
        bytes32 nameType;
        bytes32 name;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract ERC4972Account is IERC4972Account {
    IAccountFactory immutable public hexlink;

    modifier onlySelf() {
        require(msg.sender == address(this), "invalid caller");
        _;
    }

    modifier onlyOwnedAccount(bytes32 nameType, bytes32 name) {
        require(
            hexlink.getOwnedAccount(nameType, name) == address(this),
            "not owned account"
        );
        _;
    }

    constructor(address hexlink_) {
        hexlink = IAccountFactory(hexlink_);
    }

    function _setName(bytes32 nameType, bytes32 name) internal {
        ERC4972AccountStorage.layout().nameType = nameType;
        ERC4972AccountStorage.layout().name = name;
    }

    function getNameType() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().nameType;
    }

    function getName() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().name;
    }

    function getNameRegistry() external view override returns(address) {
        return address(hexlink);
    }
}