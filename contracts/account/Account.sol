//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "./IHexlinkAccount.sol";
import "./AccountStorage.sol";

contract Account is BaseAccount, IHexlinkAccount, Ownable {
    using Address for address;
    using ECDSA for bytes32;

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    address internal entrypoint_;

    constructor(address entrypoint) {
        entrypoint_ = entrypoint;
    }

    function init(
        address owner,
        bytes32 name,
        address nameRegistry
    ) external override {
        require(_owner() == address(0) && owner != address(0), "HEXL015");
        _transferOwnership(owner);
        AccountStorage.layout().name = name;
        AccountStorage.layout().nameRegistry = nameRegistry;
    }

    /** IERC4972Account */

    function getName() external view override returns(bytes32, address) {
        return (
            AccountStorage.layout().name,
            AccountStorage.layout().nameRegistry
        );
    }

    function setName(bytes32 name, address nameRegistry) external {
        _validateCaller();
        AccountStorage.layout().name = name;
        AccountStorage.layout().nameRegistry = nameRegistry;
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
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (owner() == hash.recover(userOp.signature))  {
            return 0;
        }
        return SIG_VALIDATION_FAILED;  
    }

    /** help functions */

    function _validateCaller() internal virtual {
        require(
            msg.sender == address(entryPoint())
            || msg.sender == owner()
            || msg.sender == address(this),
            "HEXLA005"
        );
    }
}
