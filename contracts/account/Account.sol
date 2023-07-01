//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IExecutable.sol";
import "./base/ERC4337Account.sol";
import "./AuthFactorManager.sol";

contract Account is
    Initializable,
    IExecutable,
    ERC4337Account,
    AuthFactorManager
{
    using Address for address;

    constructor(
        address entryPoint,
        address hexlink
    ) ERC4337Account(entryPoint, hexlink) {}

    function initialize(
        bytes32 nameType,
        bytes32 name,
        address provider
    ) public initializer {
         _setName(nameType, name);
        _initFirstFactor(provider);
    }

    /** IExectuable */

    function execute(
        UserRequest calldata request
    ) onlyEntryPoint onlyValidSigner external payable override {
        _call(request);
    }

    function executeBatch(
        UserRequest[] calldata requests
    ) onlyEntryPoint onlyValidSigner external payable override {
        for (uint256 i = 0; i < requests.length; i++) {
            _call(requests[i]);
        }
    }

    function _call(UserRequest calldata request) internal {
        (bool success, bytes memory returndata) =
            request.target.call{value : request.value}(request.data);
        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("low level call failed");
            }
        }
    }

    /** ERC4337 Validation */

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        return _validateAuthFactors(userOpHash, userOp.signature);
    }
}
