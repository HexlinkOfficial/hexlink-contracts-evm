//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IExectuable.sol";
import "./AuthFactorManager.sol";
import "./auth/IAuthFactor.sol";

contract Account is Initializable, IExectuable, AuthFactorManager, BaseAccount, UUPSUpgradeable {
    using Address for address;

    event ModuleSet(bytes32 key, address module);

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    /** keccak256("hexlink.account.module.auth") */
    bytes32 public constant AUTH_MODULE = 0x049ca10d833db85bbd7d7e16d3a37e9cf04b6c799ef2e1a180966a9ebabd57b3;
    IEntryPoint private immutable _entryPoint; 

    constructor(address entryPoint_) {
        _entryPoint = IEntryPoint(entryPoint_);
    }

    function initialize(address factor, bytes32 name) public initializer {
        _addAuthFactor(0, factor, name, new address[](0));
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

    function version() public pure returns(uint256) {
        return 1;
    }

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

    function entryPoint() public view override returns(IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        return _validateAuthFactors(userOpHash, userOp.signature);
    }

    /** AuthFactor settings */


    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address /* newImplementation */
    ) internal view override {
         _validateCaller();
    }

    /** utils */

    function _validateCaller() internal view virtual {
        require(
            msg.sender == address(entryPoint()) || msg.sender == address(this),
            "invalid caller"
        );
    }
}
