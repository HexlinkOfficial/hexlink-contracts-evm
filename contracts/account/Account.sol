//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IExectuable.sol";
import "./ModuleManager.sol";
import "./modules/IAuthModule.sol";

contract Account is BaseAccount, Initializable, IExectuable, ModuleManager, UUPSUpgradeable {
    using Address for address;

    event ModuleSet(bytes32 key, address module);

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    address internal immutable entrypoint_;
    bytes32 public constant AUTH_MODULE = 0xa8c0599be6f6588338b5081825970753181ab28be5563b61840e1d0e3306254a;

    constructor(address entrypoint) {
        entrypoint_ = entrypoint;
    }

    function initialize(
        address authModule,
        bytes memory data
    ) public initializer {
        _setAndExecModule(AUTH_MODULE, authModule, data);
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
        bytes memory data = _execModule(
            AUTH_MODULE,
            abi.encodeWithSelector(
                IAuthModule.validate.selector,
                userOpHash,
                userOp.signature
            )
        );
        return abi.decode(data, (uint256));
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

    /** ModuleManager */

    function setAndExecModule(bytes32 key, address module, bytes memory data) external {
        _validateCaller();
        _setAndExecModule(key, module, data);
        emit ModuleSet(key, module);
    }

    function execModule(bytes32 key, bytes memory data) external {
        _validateCaller();
        _execModule(key, data);
    }

    /** help functions */

    function _validateCaller() internal view virtual {
        require(
            msg.sender == address(entryPoint()) || msg.sender == address(this),
            "invalid caller"
        );
    }
}
