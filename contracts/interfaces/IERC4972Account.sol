// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IERC4972Registry.sol";

interface IERC4972Account {
    function getERC4972Registry() external view returns (IERC4972Registry);

    function getName() external view returns (bytes32);
}
