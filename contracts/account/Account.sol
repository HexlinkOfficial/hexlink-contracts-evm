//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IExecutableWithContext.sol";
import "./base/ERC4337Account.sol";
import "./AuthFactorManager.sol";
import "./AuthPolicyManager.sol";

contract Account is
    Initializable,
    IExecutableWithContext,
    ERC4337Account,
    AuthFactorManager,
    AuthPolicyManager
{
    using Address for address;

    constructor(
        address entryPoint_,
        address hexlink
    ) ERC4337Account(entryPoint_, hexlink) {}

    function initialize(bytes32 name, address authProvider) public initializer {
        _updateFirstFactor(AuthFactor(name, authProvider, 2));
    }

    /** IExectuable */

    function exec(
        UserRequest calldata request,
        RequestContext calldata ctx
    ) onlyEntryPoint onlyValidSigner external payable override {
        _callWithContext(request, ctx);
    }

    function execBatch(
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
        (bool success, bytes memory result) =
            request.target.call{value : request.value}(request.data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /** ERC4337 Validation */

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        return _validateFirstFactor(userOpHash, userOp.signature);
    }

    function getName() public view override returns(bytes32, bytes32) {
        return _getName();
    }
}
