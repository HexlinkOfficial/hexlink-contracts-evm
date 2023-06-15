//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract HexlinkErc721 is Ownable, ERC721 {
    using ECDSA for bytes32;

    uint256 private maxSupply;
    uint256 private tokenId;
    string baseURI;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI_
    ) ERC721(name, symbol) {
        baseURI = baseURI_;
    }

    function mint(address recipient) external onlyOwner {
        tokenId += 1;
        require(tokenId <= maxSupply, "Exceeding max supply");
        _safeMint(recipient, tokenId);
    }

    function increaseSupply(uint256 amount) external onlyOwner {
        maxSupply += amount;
    }

    function tokenURI(uint256 /* tokenId */)
        public view override returns (string memory)
    {
        return baseURI;
    }
}