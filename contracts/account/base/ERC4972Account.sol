//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../interfaces/IAccountFactory.sol";
import "../../interfaces/IERC4972Account.sol";
import "../../interfaces/IERC6662Account.sol";
import "../../interfaces/INameService.sol";
import "./AccountAuthBase.sol";

library ERC4972AccountStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.erc4972');
 
    struct Layout {
        bytes32 name;
        bytes32 nameService;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract ERC4972Account is
    IERC4972Account,
    IERC6662Account,
    AccountAuthBase
{
    event NameUpdated(bytes32 indexed name);

    error NameNotMatch();

    IERC4972Registry immutable internal registry_;

    constructor(address registry) {
        registry_ = IERC4972Registry(registry);
    }

    function getERC4972Registry() public view override returns(IERC4972Registry) {
        return registry_;
    }

    function getName() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().name;
    }

    function setName(bytes32 name) external onlySelf {
        ERC4972AccountStorage.layout().name = name;
        emit NameUpdated(name);
    }

    function _isOwner(address owner) internal view returns(bool) {
        return getERC4972Registry().getNameService().isOwner(getName(), owner);
    }

    /** IERC6662Account */

    function getAuthRegistry()
        external
        view
        override
        returns(IAuthRegistry)
    {
        return getERC4972Registry().getAuthRegistry();
    } 
}