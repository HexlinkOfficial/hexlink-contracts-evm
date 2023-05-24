//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IHexlinkAccount.sol";
import "./EIP4972Storage.sol";
import "./INameValidator.sol";

contract Account is BaseAccount, Initializable, IHexlinkAccount, UUPSUpgradeable {
    using Address for address;
    using ECDSA for bytes32;

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    address internal immutable entrypoint_;

    constructor(address entrypoint) {
        entrypoint_ = entrypoint;
    }

    function initialize(bytes32 name, address validator) public initializer {
        EIP4972Storage.layout().name = name;
        EIP4972Storage.layout().validator = validator;
    }

    /** IERC4972Account */

    function getName() external view override returns(bytes32, address) {
        return (
            EIP4972Storage.layout().name,
            EIP4972Storage.layout().validator
        );
    }

    /** IExectuable */

    function exec(
        address dest,
        uint256 value,
        bytes calldata func
    ) external payable override {
        _validateCaller();
        _call(dest, value, func);
    }

    function execBatch(
        address[] calldata dest,
        uint256[] calldata values,
        bytes[] calldata func
    ) external payable override {
        _validateCaller();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], values[i], func[i]);
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value : value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /** Paymaster */

    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    function addDeposit() public payable {
        entryPoint().depositTo{value : msg.value}(address(this));
    }

    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public {
        _validateCaller();
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /** ERC4337 BaseAccount */

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(entrypoint_);
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256 validationData) {
        EIP4972Storage.Layout memory s = EIP4972Storage.layout();
        return INameValidator(s.validator).validate(
            s.name, userOpHash, userOp.signature
        );
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address /* newImplementation */
    ) internal view override {
         _validateCaller();
    }

    /** help functions */

    function _validateCaller() internal view virtual {
        require(
            msg.sender == address(entryPoint()) || msg.sender == address(this),
            "invalid caller"
        );
    }
}
