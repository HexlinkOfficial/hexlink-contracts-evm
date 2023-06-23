//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IExectuable.sol";
import "./AccountModuleBase.sol";
import "./AuthFactorManager.sol";
import "./AuthPolicyManager.sol";

contract Account is
    Initializable,
    IExectuable,
    AccountModuleBase,
    BaseAccount,
    AuthFactorManager,
    AuthPolicyManager,
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

    constructor(address entryPoint_, address hexlink) AccountModuleBase(hexlink) {
        _entryPoint = IEntryPoint(entryPoint_);
    }

    function initialize(bytes32 name, address authProvider) public initializer {
        _updateFirstFactor(AuthFactor(name, authProvider, 2));
    }

    /** IExectuable */

    function exec(
        UserRequest calldata request,
        RequestContext calldata ctx
    ) onlyEntryPoint onlyValidSigner external payable override {
        _call(request, ctx);
    }

    function execBatch(
        UserRequest[] calldata requests,
        RequestContext[] calldata ctxes
    ) onlyEntryPoint onlyValidSigner external payable override {
        require(requests.length == ctxes.length, "wrong array lengths");
        for (uint256 i = 0; i < requests.length; i++) {
            _call(requests[i], ctxes[i]);
        }
    }

    function _call(
        UserRequest calldata request,
        RequestContext calldata ctx
    ) internal {
        bytes32 requestHash = keccak256(
            abi.encode(block.chainid, address(this), getNonce(), request)
        );
        _stepUp(request, requestHash, ctx);
        (bool success, bytes memory result) =
            request.target.call{value : request.value}(request.data);
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

    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) onlySelf public {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /** ERC4337 BaseAccount */

    function entryPoint() public view override returns(IEntryPoint) {
        return _entryPoint;
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        return _validateFirstFactor(userOpHash, userOp.signature);
    }

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function version() external pure returns(uint256) {
        return 1;
    }

    function _authorizeUpgrade(
        address /* newImplementation */
    ) onlySelf internal view override { }
}
