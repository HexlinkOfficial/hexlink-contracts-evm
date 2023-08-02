//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./AccountAuthBase.sol";

abstract contract ERC4337Account is
    BaseAccount,
    AccountAuthBase
{
    error onlyEntryPointCallAllowed();

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint())) {
            revert onlyEntryPointCallAllowed();
        }
        _;
    }

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    IEntryPoint private immutable _entryPoint; 

    constructor(address entryPoint_)  {
        _entryPoint = IEntryPoint(entryPoint_);
    }

    /** Paymaster */

    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    function addDeposit() public payable {
        entryPoint().depositTo{value : msg.value}(address(this));
    }

    function withdrawDepositTo(
        address payable withdrawAddress,
        uint256 amount
    ) onlySelf public {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /** ERC4337 BaseAccount */

    function entryPoint() public view override returns(IEntryPoint) {
        return _entryPoint;
    }
}
