// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../account/IHexlinkAccount.sol";
import "./IERC4972.sol";
import "./IAccountFactory.sol";
import "../utils/IHexlinkERC1967Proxy.sol";
import "../account/INameValidator.sol";

contract Hexlink is IAccountFactory, IERC4972, Initializable, Ownable, UUPSUpgradeable {
    event Deployed(bytes32 indexed name, address indexed account);

    address public immutable accountBase;
    INameValidator public immutable nameValidator;

    constructor(
        address accountBase_,
        address nameValidator_
    ) {
        accountBase = accountBase_;
        nameValidator = INameValidator(nameValidator_);
    }

    receive() external payable { }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /** IERC4972 */

    function ownedAccount(
        bytes32 name
    ) external view override returns(address) {
        return Clones.predictDeterministicAddress(address(this), name);
    }

    /** IAccountFactory */

    function deploy(bytes32 name) external override returns(address account) {
        account = Clones.cloneDeterministic(address(this), name);
        bytes memory data = abi.encodeWithSignature(
            "initialize(bytes32,address)", name, address(nameValidator)
        );
        IHexlinkERC1967Proxy(account).initProxy(accountBase, data);
        emit Deployed(name, account);
    }

    /** UUPSUpgradeable */

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }

    /** exec */

    function exec(
        address target,
        uint256 value,
        bytes calldata data
    ) onlyOwner external {
        (bool success, bytes memory result) = target.call{value : value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}