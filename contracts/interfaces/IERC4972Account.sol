// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./INameService.sol";
import "./IERC4972Registry.sol";

interface IERC4972Account {
    function getNameService() external view returns (INameService);

    function getName() external view returns (bytes32);

    function getERC4972Registry() external view returns (IERC4972Registry);
}
