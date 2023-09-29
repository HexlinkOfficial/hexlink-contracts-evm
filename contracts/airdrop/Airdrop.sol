// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Airdrop {
    using ECDSA for bytes32;

    error NotAuthorized();
    error AlreadyClaimed(uint256 campaign, address to);
    error CampaignNotStarted(uint256 campaign);
    error CampaignAlreadyEnded(uint256 campaign);
    error CampaignNotEnded(uint256 campaign);
    error CampaignNotExist(uint256 campaign);
    error InvalidCampaignInput(Campaign c);
    error InSufficientBalance(
        uint256 campaign,
        uint256 balance,
        uint256 expected
    );

    struct Campaign {
        address token;
        uint48 startAt;
        uint48 endAt;
        uint256 amount;
        address owner;
    }

    event NewCampaign(
        uint256 indexed batch,
        Campaign info
    );
    event Claim(
        uint256 batch,
        address indexed to
    );
    event ClaimBatch(
        uint256 batch,
        address[] indexed to
    );

    uint256 nextCampaign = 0;
    mapping(uint256 => Campaign) internal campaigns;
    mapping(uint256 => mapping(address => bool)) internal claimed;

    function getNextCampaign() external view returns(uint256) {
        return nextCampaign;
    }

    function getCampaign(
        uint256 campaign
    ) external view returns(Campaign memory) {
        return campaigns[campaign];
    }

    function hasClaimed(
        uint256 campaign,
        address to
    ) public view returns(bool) {
        return claimed[campaign][to];
    }

    /* campaign */

    function createCampaign(Campaign memory c) external {
        if (c.amount == 0) {
            revert InvalidCampaignInput(c);
        }
        campaigns[nextCampaign] = c;
        emit NewCampaign(nextCampaign, c);
        nextCampaign++;
    }

    function withdraw(uint256 campaign, uint256 amount) external {
        Campaign memory c = campaigns[campaign];
        if (msg.sender != c.owner) {
            revert NotAuthorized();
        }
        if (block.timestamp <= c.endAt) {
            revert CampaignNotEnded(campaign);
        }
        IERC20(c.token).transfer(c.owner, amount);
    }

    /* claim */

    function selfClaim(
        uint256 campaign,
        address to,
        bytes memory proof
    ) external {
        Campaign memory c = _getCampaign(campaign);
        bytes32 message = keccak256(
            abi.encodePacked(block.chainid, address(this), campaign, to)
        );
        if (message.toEthSignedMessageHash().recover(proof) != c.owner) {
            revert NotAuthorized();
        }
        _claimOne(c, campaign, to);
    }

    function claimOne(uint256 campaign, address to) external {
        Campaign memory c = _getCampaign(campaign);
        if (msg.sender != c.owner) {
            revert NotAuthorized();
        }
        _claimOne(c, campaign, to);
    }

    function claimBatch(uint256 campaign, address[] memory receipts) external {
        Campaign memory c = _getCampaign(campaign);
        if (msg.sender != c.owner) {
            revert NotAuthorized();
        }
        uint256 balance = _getBalance(c.token);
        uint256 expected = c.amount * receipts.length;
        if (balance < expected) {
            revert InSufficientBalance(campaign, balance, expected);
        }
        for (uint i = 0; i < receipts.length; i++) {
            address to = receipts[i];
            if (hasClaimed(campaign, to)) {
                revert AlreadyClaimed(campaign, to);
            }
            claimed[campaign][to] = true;
            _transfer(c.token, to, c.amount);
        }
        emit ClaimBatch(campaign, receipts);
    }

    function _claimOne(
        Campaign memory c,
        uint256 campaign,
        address to
    ) internal {
        uint256 balance = _getBalance(c.token);
        if (balance < c.amount) {
            revert InSufficientBalance(campaign, balance, c.amount);
        }
        if (hasClaimed(campaign, to)) {
            revert AlreadyClaimed(campaign, to);
        }
        claimed[campaign][to] = true;
        _transfer(c.token, to, c.amount);
        emit Claim(campaign, to);
    }

    function _getCampaign(
        uint256 campaign
    ) internal view returns(Campaign memory) {
        Campaign memory c = campaigns[campaign];
        if (c.owner == address(0)) {
            revert CampaignNotExist(campaign);
        }
        if (block.timestamp < c.startAt) {
            revert CampaignNotStarted(campaign);
        }
        if (block.timestamp > c.endAt) {
            revert CampaignAlreadyEnded(campaign);
        }
        return c;
    }

    function _getBalance(address token) internal view returns(uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            Address.sendValue(payable(to), amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }
}