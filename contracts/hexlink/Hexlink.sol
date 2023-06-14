// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/StakeManager.sol";

import "./IERC4972.sol";
import "./IAccountFactory.sol";
import "../utils/IHexlinkERC1967Proxy.sol";
import "../account/Account.sol";

contract Hexlink is IAccountFactory, IERC4972, Initializable, Ownable, UUPSUpgradeable {
    event Deployed(
        bytes32 indexed nameType,
        bytes32 indexed name,
        address indexed account
    );

    error InvalidNameType();

    address public immutable accountBase;
    address public immutable authModule;
    IStakeManager public immutable entrypoint;

    // keccak256("mailto");
    bytes32 public constant MAILTO = 0xa494cfc40d31c3891835fac394fbcdd0bf27978f8af488c9a97d9b406b1ad96e;
    // keccak256("tel");
    bytes32 public constant TEL = 0xeeef3d88e44720eeae328f3cead00ac0a41c6a29bad00b2cdf1b4cdb919afe81;

    constructor(
        address accountBase_,
        address authModule_,
        address entrypoint_
    ) {
        accountBase = accountBase_;
        authModule = authModule_;
        entrypoint = IStakeManager(entrypoint_);
    }

    receive() external payable { }

    function initialize(address owner) public initializer {
        _transferOwnership(owner);
    }

    /** IERC4972 */

    function ownedAccount(
        bytes32 nameType,
        bytes32 name
    ) external view override returns(address) {
        return Clones.predictDeterministicAddress(
            address(this),
            _nameHash(nameType, name)
        );
    }

    /** IAccountFactory */

    function deploy(
        bytes32 nameType,
        bytes32 name
    ) external override returns(address account) {
        account = Clones.cloneDeterministic(
            address(this),
            _nameHash(nameType, name)
        );
        bytes memory moduleData = abi.encodeWithSignature(
            "setName(bytes32,bytes32)",
            nameType,
            name
        );
        bytes memory data = abi.encodeWithSelector(
            Account.initialize.selector,
            _getAuthModule(nameType),
            moduleData
        );
        IHexlinkERC1967Proxy(account).initProxy(accountBase, data);
        emit Deployed(nameType, name, account);
    }

    /** UUPSUpgradeable */

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }

    /** utils */

    function _nameHash(
        bytes32 nameType,
        bytes32 name
    ) internal pure returns(bytes32) {
        return keccak256(abi.encode(nameType, name));
    }

    function _getAuthModule(bytes32 nameType) internal view returns(address) {
        if (nameType == MAILTO || nameType == TEL) {
            return authModule;
        } else {
            revert InvalidNameType();
        }
    }

    /** Entrypoint contract staking */

    function addStake(uint32 unstakeDelaySec) onlyOwner external payable {
        entrypoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() onlyOwner external {
        entrypoint.unlockStake();
    }

    function withdrawStake() external {
        entrypoint.withdrawStake(payable(owner()));
    }
}