//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../../interfaces/IAccountFactory.sol";
import "../../interfaces/IERC4972Account.sol";
import "../../interfaces/INameService.sol";
import "./AccountAuthBase.sol";

library ERC4972AccountStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.erc4972');
 
    struct Layout {
        bytes32 name;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract ERC4972Account is IERC4972Account, AccountAuthBase {
    IAccountFactory immutable internal factory_;
    INameService immutable internal nameService_;

    event NameUpdated(bytes32 indexed name);

    constructor(address erc4972Registry, address nameService) {
        factory_ = IAccountFactory(erc4972Registry);
        nameService_ = INameService(nameService);
    }

    function setName(bytes32 name) external onlySelf {
        _setName(name);
        emit NameUpdated(name);
    }

    function getName() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().name;
    }

    function getNameService() public view override returns(INameService) {
        return nameService_;
    }

    function getERC4972Registry()
        public
        view
        override
        returns(IERC4972Registry)
    {
        return factory_;
    }

    function _setName(bytes32 name) internal {
        ERC4972AccountStorage.layout().name = name;
    }

    function _isOwner(address owner) internal view returns(bool) {
        return getNameService().isOwner(IERC4972Account(address(this)), owner);
    } 
}