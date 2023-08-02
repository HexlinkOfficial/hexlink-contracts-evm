//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestHexlinkERC20 is ERC20 {
    constructor() ERC20("hexlink", "HEXL") {
        _mint(msg.sender, 1000000000);
    }
}
