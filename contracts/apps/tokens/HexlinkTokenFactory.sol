//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract HexlinkTokenFactoryImpl is Ownable, UUPSUpgradeable {
    event Deployed(address indexed creator, bytes32 salt, address deployed);

    address public erc721Impl;

    function init(address owner, address erc721Impl_) external {
        require(_owner() == address(0), "Already initiated");
        _transferOwnership(owner);
        erc721Impl = erc721Impl_;
    }

    function setErc721Impl(address erc721Impl_) external {
        erc721Impl = erc721Impl_;
    }

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }

    function deployErc721(bytes32 salt, bytes memory initData) external {
        salt = keccak256(abi.encode(msg.sender, salt));
        address deployed = Clones.cloneDeterministic(erc721Impl, salt);
        (bool success, bytes memory data) = deployed.call(initData);
        Address.verifyCallResult(success, data, "Failed to init contract");
        IERC173(deployed).transferOwnership(msg.sender);
        emit Deployed(msg.sender, salt, deployed);
    }

    function predictErc721Address(bytes32 salt) external view returns(address) {
        return Clones.predictDeterministicAddress(erc721Impl, salt);
    }
}

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract HexlinkTokenFactory is ERC1967Proxy {
    constructor(
        address logic,
        bytes memory data
    ) ERC1967Proxy(logic, data) payable {}
}
