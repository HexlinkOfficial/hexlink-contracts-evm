// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/samples/SimpleAccount.sol";

contract HexlinkPaymaster is Initializable, UUPSUpgradeable, BasePaymaster {
    event Approved(address indexed target, bytes4 indexed selector);
    event Unapproved(address indexed target, bytes4 indexed selector);

    error NotFromHexlinkAccount();
    error NotHexlinkExcutionFunction();
    error NotClaimingAirdrop();

    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;
    uint256 private constant SIGNATURE_OFFSET = 84;
    address public immutable hexlink;
    address public immutable hexlinkDev;
    mapping(bytes32 => bool) allowed;

    constructor(
        IEntryPoint _entryPoint,
        address _hexlink,
        address _hexlinkDev
    ) BasePaymaster(_entryPoint) {
        hexlink = _hexlink;
        hexlinkDev = _hexlinkDev;
    }

    function initialize(
        address owner,
        address[] memory targets,
        bytes4[] memory selectors
    ) public initializer {
        _transferOwnership(owner);
        for (uint i = 0; i < targets.length; i++) {
            approve(targets[i], selectors[i]);
        }
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }

    /* HexlinkPaymaster */

    function approve(address target, bytes4 selector) public onlyOwner {
        allowed[_genKey(target, selector)] = true;
        emit Approved(target, selector);
    }

    function unapprove(address target, bytes4 selector) external onlyOwner {
        allowed[_genKey(target, selector)] = false;
        emit Unapproved(target, selector);
    }

    function isApproved(address target, bytes4 selector) public view returns(bool) {
        return allowed[_genKey(target, selector)];
    }

    /* BasePaymaster */

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 /* requiredPreFund */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        address factory = address(bytes20(userOp.paymasterAndData[20:40]));
        if (factory != hexlink && factory != hexlinkDev) {
            revert NotFromHexlinkAccount();
        }

        bytes32 name = bytes32(userOp.paymasterAndData[40:72]);
        address account = _getHexlinkAccount(factory, name);
        if (userOp.sender != account) {
            revert NotFromHexlinkAccount();
        }
        if (SimpleAccount.execute.selector != bytes4(userOp.callData[0:4])) {
            revert NotHexlinkExcutionFunction();
        }
        // target of execute
        address target = address(uint160(uint256(bytes32(userOp.callData[4:36]))));
        // skip value and the location and length of claim calldata(bytes64)
        bytes4 selector = bytes4(userOp.callData[132:136]);
        if (!isApproved(target, selector)) {
            revert NotClaimingAirdrop();
        }
        return ("", _packValidationData(false, 0, 0));
    }

    function _genKey(address target, bytes4 selector) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(target, selector));
    }

    function _getHexlinkAccount(
        address impl,
        bytes32 salt
    ) internal pure returns (address account) {
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(add(ptr, 0x38), impl)
            mstore(add(ptr, 0x24), 0x5af43d82803e903d91602b57fd5bf3ff)
            mstore(add(ptr, 0x14), impl)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73)
            mstore(add(ptr, 0x58), salt)
            mstore(add(ptr, 0x78), keccak256(add(ptr, 0x0c), 0x37))
            account := keccak256(add(ptr, 0x43), 0x55)
        }
    }
}
