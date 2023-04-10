//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "./IERC4972Account.sol";
import "./IExectuable.sol";

interface IHexlinkAccount is IERC4972Account, IExectuable{
    function init(
        address owner,
        bytes32 name,
        address nameRegistry
    ) external;
}