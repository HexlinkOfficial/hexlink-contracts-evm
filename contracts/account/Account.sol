//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IExecutable.sol";
import "./interfaces/IExecutableWithContext.sol";
import "./base/ERC4337Account.sol";
import "./AuthPolicyManager.sol";

contract Account is
    Initializable,
    IExecutable,
    IExecutableWithContext,
    ERC4337Account,
    AuthPolicyManager
{
    using Address for address;

    constructor(
        address entryPoint_,
        address hexlink
    ) ERC4337Account(entryPoint_, hexlink) {}

    function initialize(AuthFactor memory factor) public initializer {
        _initFirstFactor(factor);
    }

    /** IExectuable */

    function execute(
        UserRequest calldata request
    ) onlyEntryPoint onlyValidSigner external payable override {
        require(!_isSecondFactorEnabled(), "must call with context");
        _call(request);
    }

    function executeBatch(
        UserRequest[] calldata requests
    ) onlyEntryPoint onlyValidSigner external payable override {
        require(!_isSecondFactorEnabled(), "must call with context");
        for (uint256 i = 0; i < requests.length; i++) {
            _call(requests[i]);
        }
    }

    function _call(UserRequest calldata request) internal {
        (bool success, bytes memory result) =
            request.target.call{value : request.value}(request.data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /** IExectuableWithContext */

    function executeWithContext(
        UserRequest calldata request,
        RequestContext calldata ctx
    ) onlyEntryPoint onlyValidSigner external payable override {
        _callWithContext(request, ctx);
    }

    function executeBatchWithContext(
        UserRequest[] calldata requests,
        RequestContext[] calldata ctxes
    ) onlyEntryPoint onlyValidSigner external payable override {
        require(requests.length == ctxes.length, "wrong array lengths");
        for (uint256 i = 0; i < requests.length; i++) {
            _callWithContext(requests[i], ctxes[i]);
        }
    }

    function _callWithContext(
        UserRequest calldata request,
        RequestContext calldata ctx
    ) internal {
        bytes32 requestHash = keccak256(
            abi.encode(block.chainid, address(this), getNonce(), request)
        );
        _stepUp(request, requestHash, ctx);
        _call(request);
    }

    /** ERC4337 Validation */

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        return _validateFirstFactor(userOpHash, userOp.signature);
    }
}
