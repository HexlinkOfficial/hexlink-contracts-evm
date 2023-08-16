//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/IAccountInitializer.sol";
import "../interfaces/IExecutionManager.sol";
import "../interfaces/IVersion.sol";
import "../interfaces/IVersionManager.sol";
import "./base/ERC4337Account.sol";
import "./base/ERC4972Account.sol";
import "./base/Simple2FA.sol";

contract Account is
    IAccountInitializer,
    IVersion,
    Initializable,
    IExecutionManager,
    ERC4337Account,
    ERC4972Account,
    Simple2FA,
    UUPSUpgradeable
{
    error InvalidAccountImplementation();
    error InvalidSignType(uint8);

    constructor(
        address entryPoint,
        address hexlink
    ) ERC4337Account(entryPoint)
      AccountAuthBase(hexlink) { }

    function initialize(bytes32 name, address owner) public override initializer {
        _ERC4972Account_init(name, owner);
    }

    function version() public override virtual pure returns (uint256) {
        return 2;
    }

    /** IExecutionManager */

    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external override onlyEntryPoint onlyValidNameOwner {
        _call(dest, value, func);
    }

    function executeBatch(
        address[] calldata dest,
        bytes[] calldata func
    ) external override onlyEntryPoint onlyValidNameOwner {
        for (uint256 i = 0; i < dest.length;) {
            _call(dest[i], 0, func[i]);
            unchecked {
                i++;
            }
        }
    }

    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external override onlyEntryPoint onlyValidNameOwner {
        for (uint256 i = 0; i < dest.length;) {
            _call(dest[i], value[i], func[i]);
            unchecked {
                i++;
            }
        }
    }

    function _call(address target, uint256 value, bytes memory data) private {
        assembly {
            let result := call(gas(), target, value, add(data, 0x20), mload(data), 0, 0)
            if iszero(result) {
                let ptr := mload(0x40)
                returndatacopy(ptr, 0, returndatasize())
                revert(ptr, returndatasize())
            }
        }
    }

    /** ERC4337 Validation */

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        uint8 signType = uint8(userOp.signature[0]);
        if(signType != 0x00) {
            revert InvalidSignType(signType);
        }
        uint96 timeRange = uint96(bytes12(userOp.signature[1:13]));
        bytes32 message = keccak256(abi.encodePacked(signType, timeRange, userOpHash));
        message = keccak256(abi.encodePacked(getName(), message));
        bool valid = _validateNameOwner(message, userOp.signature[13:78]);
        if (valid && getSecondFactor() != address(0)) {
            valid = valid && _validateSecondFactor(message, userOp.signature[78:143]);
        }
        return (uint256(timeRange) << 160) | (valid ? 0 : 1);
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) onlySelf internal view override {
        uint256 v = IVersion(newImplementation).version();
        if (v < version()) {
            revert InvalidAccountImplementation();
        }
        address impl = IVersionManager(hexlink_).getImplementation(v);
        if (impl != newImplementation) {
            revert InvalidAccountImplementation();
        }
    }
}
