//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.8;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../utils/GasSponsor.sol";

contract HexlinkErc721Impl is
    Initializable,
    OwnableUpgradeable,
    ERC721Upgradeable,
    GasSponsor
{
    using ECDSA for bytes32;

    mapping(address => uint256) internal minted_;
    string public baseTokenURI;
    uint256 public maxSupply;
    uint256 public tokenId = 0;
    address public validator;
    bool public transferrable;
    uint256 public gasSponsorship;

    function init(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        uint256 maxSupply_,
        address validator_,
        bool transferrable_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init();
        maxSupply = maxSupply_;
        validator = validator_;
        baseTokenURI = baseTokenURI_;
        transferrable = transferrable_;
    }

    function mint(
        address recipient,
        address refundReceiver,
        bytes memory signature
    ) external {
        uint256 gasUsed = gasleft();
        tokenId += 1;
        require(tokenId <= maxSupply, "Exceeding max supply");
        _validateSiganture(recipient, refundReceiver, signature);
        _validateCount();
        _safeMint(recipient, tokenId);
        if (gasSponsorship > 0 && refundReceiver != address(0)) {
            uint256 payment = (gasUsed + 80000) * tx.gasprice;
            gasSponsorship -= payment;
            _sponsorGas(payment, refundReceiver);
        }
    }

    function depositGasSponsorship() external payable {
        gasSponsorship += msg.value;
    }

    function getMintedCount(address user) external view returns(uint256){
        return minted_[user];
    }

    function setValidator(address _validator) external onlyOwner {
        validator = _validator;
    }

    function _validateSiganture(
        address recipient,
        address refundReceiver,
        bytes memory signature
    ) internal view {
        bytes32 message = keccak256(
            abi.encode(block.chainid, address(this), recipient, refundReceiver)
        );
        bytes32 reqHash = message.toEthSignedMessageHash();
        require(validator == reqHash.recover(signature), "invalid signature");
    }

    function _validateCount() internal {
        require(minted_[msg.sender] == 0, "Already minted");
        minted_[msg.sender] += 1;
    }

    function tokenURI(uint256 /* tokenId */)
        public view override returns (string memory)
    {
        return baseTokenURI;
    }

    function _afterTokenTransfer(
        address from,
        address /* to */,
        uint256 /* firstTokenId */,
        uint256 /* batchSize */
    ) internal override virtual {
        require(from == address(0) || transferrable, "Transfer not allowed");
    }
}