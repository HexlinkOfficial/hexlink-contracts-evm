// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IServiceRegistry.sol";

contract ServiceRegistry is IServiceRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    error InsufficientStake();
    error BelowMinStake();
    error StakeLocked();
    error ServiceNotOpenToNewSubscription();
    error InsufficientDeposit();

    address immutable stakingToken;
    uint256 constant public MIN_STAKE_PER_USER = 10;

    struct ServiceState {
        bytes32 metadata;
        uint256 staked;
        uint256 lockedUtil;
        bool enabled;
        EnumerableSet.AddressSet subscribers;
    }
    mapping(address => ServiceState) internal registry;

    struct PriceInfo {
        uint256 price;
        uint256 minDeposit;
    }
    mapping(address => mapping(address => PriceInfo)) internal prices;

    struct UserState {
        uint256 total;
        uint256 minRequired;
    }
    mapping(address => mapping(address => UserState)) internal deposit;

    constructor(address token_) {
        stakingToken = token_;
    }

    function setMetadata(bytes32 metadata_) external {
        registry[msg.sender].metadata = metadata_;
    }

    function getMetadata() external view returns(bytes32) {
        return registry[msg.sender].metadata;
    }

    function stake(uint256 amount) external {
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        registry[msg.sender].staked += amount;
    }

    function unstake(uint256 amount) external {
        if (registry[msg.sender].staked < amount) {
            revert InsufficientStake();
        }
        if (registry[msg.sender].lockedUtil == 0) {
            registry[msg.sender].lockedUtil = block.timestamp + 604800;
            return;
        }
        if (registry[msg.sender].lockedUtil > block.timestamp) {
            revert StakeLocked();
        }
        uint256 minStake = registry[msg.sender].subscribers.length() * 10;
        if (registry[msg.sender].staked - amount < minStake) {
            revert BelowMinStake();
        }
        IERC20(stakingToken).transfer(msg.sender, amount);
        registry[msg.sender].lockedUtil = 0;
    }

    function openSubscription() external {
        registry[msg.sender].enabled = true;
    }

    function closeSubscription() external {
        registry[msg.sender].enabled = false;
    }

    function getToken() external view returns(address) {
        return stakingToken;
    }

    function setPrice(address token, uint256 price) external {
        prices[msg.sender][token].price = price;
    }

    function setMinDeposit(address token, uint256 minDeposit) external {
        prices[msg.sender][token].minDeposit = minDeposit;
    }

    function getPrice(address token) external view returns(PriceInfo memory) {
        return prices[msg.sender][token];
    }

    function addDeposit(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function getDeposit(address token) external view returns(uint256) {
        return deposit[msg.sender][token].total;
    }

    function subscribe(address service, address token) external {
        if (registry[service].enabled == false) {
            revert ServiceNotOpenToNewSubscription();
        }
        deposit[msg.sender][token].minRequired += prices[service][token].minDeposit;
        if (deposit[msg.sender][token].total < deposit[msg.sender][token].minRequired) {
            revert InsufficientDeposit();
        }
        registry[service].subscribers.add(msg.sender);
        uint256 minStake = registry[service].subscribers.length() * 10;
        if (registry[service].staked < minStake) {
            revert BelowMinStake();
        }
    }
}