//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@account-abstraction/contracts/samples/callback/TokenCallbackHandler.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IERC4972Account.sol";
import "../interfaces/IERC4972AccountInitializer.sol";
import "../interfaces/IExecutionManager.sol";
import "../interfaces/IVersion.sol";
import "../interfaces/IVersionManager.sol";
import "./base/ERC4337Account.sol";
import "./base/Simple2FA.sol";

library ERC4972AccountStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.erc4972');
 
    struct Layout {
        bytes32 name;
        address owner;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

contract ERC4972Account is
    IERC4972AccountInitializer,
    IVersion,
    Initializable,
    IExecutionManager,
    IERC4972Account,
    TokenCallbackHandler,
    ERC4337Account,
    Simple2FA,
    UUPSUpgradeable
{
    using ECDSA for bytes32;

    event NameUpdated(bytes32 indexed name);
    event NameOwnerUpdated(address indexed);

    error InvalidNameToSet(bytes32 name);
    error InvalidNameOwner(address owner);
    error InvalidAccountImplementation();
    error InvalidSignType(uint8);

    modifier onlyValidNameOwner() {
        if (!setNameOwner()) {
            _;
        }
    }

    constructor(
        address entryPoint,
        address hexlink
    ) ERC4337Account(entryPoint)
      AccountAuthBase(hexlink) { }

    function initialize(bytes32 name, address owner) public override initializer {
        ERC4972AccountStorage.layout().name = name;
        ERC4972AccountStorage.layout().owner = owner;
    }

    function version() public override virtual pure returns (uint256) {
        return 1;
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
        if (valid && isSecondFactorEnabled()) {
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

    /** ERC4972 */

    function getERC4972Registry() public view override returns(IERC4972Registry) {
        return IERC4972Registry(hexlink_);
    }

    function getName() public view override returns(bytes32) {
        return ERC4972AccountStorage.layout().name;
    }

    function getNameOwner() public view returns(address) {
        return ERC4972AccountStorage.layout().owner;
    }

    function setNameOwner() public returns(bool updated) {
        address owner = IERC4972Registry(hexlink_).getNameService().owner(getName());
        if (owner == ERC4972AccountStorage.layout().owner) {
            return false;
        }
        ERC4972AccountStorage.layout().owner = owner;
        emit NameOwnerUpdated(owner);
        return true;
    }

    function setName(bytes32 name) external onlySelf {
        if (IERC4972Registry(hexlink_).getOwnedAccount(name) != address(this)) {
            revert InvalidNameToSet(name);
        }
        ERC4972AccountStorage.layout().name = name;
        emit NameUpdated(name);
    }

    function _validateNameOwner(
        bytes32 message,
        bytes memory signature
    ) internal returns(bool) {
        address signer = ECDSA.recover(message.toEthSignedMessageHash(), signature);
        address owner = ERC4972AccountStorage.layout().owner;
        if (owner == address(0)) {
            ERC4972AccountStorage.layout().owner = signer;
        }
        return signer == owner;
    }
}
