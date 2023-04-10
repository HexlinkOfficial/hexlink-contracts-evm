//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "../structs/AuthenticatorInfo.sol";

interface IAccountMetadata {
  function getAuthenticationInfo()
    external
    view
    returns(AuthenticatorInfo[] memory);
}