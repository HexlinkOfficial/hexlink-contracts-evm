//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./AccountModuleBase.sol";

abstract contract ERC4337Account is
    AccountModuleBase,
    BaseAccount,
    UUPSUpgradeable
{
    using Address for address;

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint()), "invalid caller");
        _;
    }

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    IEntryPoint private immutable _entryPoint; 

    constructor(
        address entryPoint_,
        address hexlink
    ) AccountModuleBase(hexlink) {
        _entryPoint = IEntryPoint(entryPoint_);
    }

    /** Paymaster */

    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    function addDeposit() public payable {
        entryPoint().depositTo{value : msg.value}(address(this));
    }

    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) onlySelf public {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /** ERC4337 BaseAccount */

    function entryPoint() public view override returns(IEntryPoint) {
        return _entryPoint;
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) onlySelf internal view override {
        require(
            newImplementation == hexlink.getAccountImplementation(),
            "invalid implementation"
        );
    }
}
