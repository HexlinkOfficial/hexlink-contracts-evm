//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

interface IHexlinkERC1967Proxy {
    function implementation() external view returns(address);

    function initProxy(address logic, bytes memory data) external;
}