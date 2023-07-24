// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "./IERC4972Account.sol";

interface INameService {
    function isOwner(
        IERC4972Account account,
        address owner
    ) external view returns(bool);

    function isSupported(bytes32 nameType) external view returns(bool);
}
