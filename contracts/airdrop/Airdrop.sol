// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract Airdrop is Ownable, UUPSUpgradeable, Initializable, Pausable {
    using ECDSA for bytes32;

    error NotAuthorized();
    error NotCalledFromClaimer();
    error AlreadyClaimed();
    error CampaignNotStarted();
    error CampaignAlreadyEnded();
    error CampaignNotEnded();
    error CampaignNotExist();
    error InvalidCampaignInput();
    error InsufficientDeposit(uint256 actual, uint256 expected);

    struct Campaign {
        address token;
        uint48 startAt;
        uint48 endAt;
        uint256 deposit;
        address validator;
        address owner;
        // 0: only to beneficiary
        // 1: to both claimer and beneficiary if claimer is not beneficiary
        uint8 mode;
    }

    event NewCampaign(
        uint256 indexed campaignId,
        Campaign campaign
    );
    event NewClaim(
        uint256 indexed campaignId,
        address indexed claimer,
        address indexed beneficiary,
        uint256 amount
    );
    event NewClaimWithMessage(
        uint256 indexed campaignId,
        address indexed claimer,
        address indexed beneficiary,
        uint256 amount,
        string message
    );

    uint256 nextCampaign = 0;
    mapping(uint256 => Campaign) internal campaigns;
    mapping(uint256 => mapping(address => bool)) internal claimed;

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    function pause() onlyOwner external {
        _pause();
    }

    function unpause() onlyOwner external {
        _unpause();
    }

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

    /* campaign management */

    function createCampaign(Campaign memory c) whenNotPaused external {
        if (c.deposit == 0 || c.owner == address(0)) {
            revert InvalidCampaignInput();
        }
        _deposit(c.token, c.deposit);
        campaigns[nextCampaign] = c;
        emit NewCampaign(nextCampaign, c);
        nextCampaign++;
    }

    function setCampaignExpiry(uint256 campaign, uint48 endAt) external whenNotPaused {
        if (campaigns[campaign].owner != msg.sender) {
            revert NotAuthorized();
        }
        campaigns[campaign].endAt = endAt;
    }

    function transferCampaignOwnership(
        uint256 campaign,
        address newOwner
    ) external whenNotPaused {
        if (campaigns[campaign].owner != msg.sender) {
            revert NotAuthorized();
        }
        campaigns[campaign].owner = newOwner;
    }

    function deposit(uint256 campaign, uint256 amount) external whenNotPaused {
        Campaign memory c = campaigns[campaign];
        if (c.owner == address(0) || c.validator == address(0)) {
            revert CampaignNotExist();
        }
        _deposit(c.token, amount);
        campaigns[campaign].deposit = c.deposit + amount;
    }

    function withdraw(uint256 campaign) external whenNotPaused {
        Campaign memory c = campaigns[campaign];
        if (msg.sender != c.owner) {
            revert NotAuthorized();
        }
        if (block.timestamp <= c.endAt) {
            revert CampaignNotEnded();
        }
        campaigns[campaign].deposit = 0;
        _transfer(c.token, c.owner, c.deposit);
    }

    /* claim */
    function claimV2(
        uint256 campaign,
        address beneficiary,
        uint256 amount,
        bytes memory proof
    ) external whenNotPaused {
        bytes32 signed = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                campaign,
                msg.sender,
                beneficiary,
                amount
            )
        );
        _claim(campaign, beneficiary, amount, signed, proof);
        emit NewClaim(campaign, msg.sender, beneficiary, amount);
    }

    function claimV2WithMessage(
        uint256 campaign,
        address beneficiary,
        uint256 amount,
        string calldata message,
        bytes memory proof
    ) external whenNotPaused {
        bytes32 signed = keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                campaign,
                msg.sender,
                beneficiary,
                amount,
                message
            )
        );
        _claim(campaign, beneficiary, amount, signed, proof);
        emit NewClaimWithMessage(
            campaign, msg.sender, beneficiary, amount, message);
    }

    function _claim(
        uint256 campaign,
        address beneficiary,
        uint256 amount,
        bytes32 message,
        bytes memory proof
    ) internal {
        if (hasClaimed(campaign, msg.sender)) {
            revert AlreadyClaimed();
        }
        Campaign memory c = _getCampaign(campaign);
        bool isDoubleClaim = (c.mode == 1 && msg.sender != beneficiary);
        uint256 totalAirdrop = amount * (isDoubleClaim ? 2 : 1);
        if (c.deposit < totalAirdrop) {
            revert InsufficientDeposit(c.deposit, amount);
        }
        if (message.toEthSignedMessageHash().recover(proof) != c.validator) {
            revert NotAuthorized();
        }
        claimed[campaign][msg.sender] = true;
        campaigns[campaign].deposit = c.deposit - totalAirdrop;
        _transfer(c.token, beneficiary, amount);
        if (isDoubleClaim) {
            _transfer(c.token, msg.sender, amount);
        }
    }

    function _getCampaign(
        uint256 campaign
    ) internal view returns(Campaign memory) {
        Campaign memory c = campaigns[campaign];
        if (c.owner == address(0)) {
            revert CampaignNotExist();
        }
        if (block.timestamp < c.startAt) {
            revert CampaignNotStarted();
        }
        if (block.timestamp > c.endAt) {
            revert CampaignAlreadyEnded();
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

    function _deposit(address token, uint256 amount) internal {
        if (token == address(0)) {
            if (msg.value < amount) {
                revert InsufficientDeposit(msg.value, amount);
            }
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            Address.sendValue(payable(to), amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }
}