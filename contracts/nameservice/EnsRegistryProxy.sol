// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./INameServiceRegistryProxy.sol";

contract EnsRegistryProxy is INameServiceRegistryProxy {
    bytes32 constant private ENS_NODE = keccak256(abi.encodePacked("eth"));

    function getChainId() public pure returns(uint256) {
        return 1;
    }

    function getRegistry() public pure returns(address) {
        return 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    }

    function resolverOf(uint256 tokenId) external view override returns(address) {
        bytes32 node = keccak256(abi.encodePacked(ENS_NODE, tokenId));
        if (getChainId() == block.chainid) {
            return ENS(getRegistry()).resolver(node);
        }
        revert CrossChainLookup(_buildW3Url("resolver", node));
    }

    function ownerOf(uint256 tokenId) external view override returns(address) {
        bytes32 node = keccak256(abi.encodePacked(ENS_NODE, tokenId));
        if (getChainId() == block.chainid) {
            return ENS(getRegistry()).owner(node);
        }
        revert CrossChainLookup(_buildW3Url("owner", node));
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns(bool) {
        return interfaceId == type(INameServiceRegistryProxy).interfaceId
            || interfaceId == type(INameServiceRegistry).interfaceId;
    }

    function _buildW3Url(
        string memory method,
        bytes32 node
    ) private pure returns(string memory) {
        return string.concat(
            "w3://0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e:1/",
            method,
            "/",
            Strings.toHexString(uint256(node)),
            "?returns=(address)"
        );
    }
}