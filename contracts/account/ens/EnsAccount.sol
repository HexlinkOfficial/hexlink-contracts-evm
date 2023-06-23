//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IExecutable.sol";
import "../base/ERC4337Account.sol";
import "./EnsValidator.sol";

contract EnsAccount is
    IExecutable,
    Initializable,
    ERC4337Account,
    EnsValidator
{
    using Address for address;

    constructor(
        address entryPoint_,
        address hexlink,
        address authProvider
    ) ERC4337Account(entryPoint_, hexlink) EnsValidator(authProvider) {}

    function initialize(bytes32 name) public initializer {
        _initName(name);
    }

    /** IExectuable */

    function exec(
        UserRequest calldata request
    ) external payable override onlyEntryPoint onlyValidSigner {
        _call(request);
    }

    function execBatch(
        UserRequest[] calldata requests
    ) external payable override onlyEntryPoint onlyValidSigner {
        for (uint256 i = 0; i < requests.length; i++) {
            _call(requests[i]);
        }
    }

    function _call(UserRequest calldata request) internal {
        (bool success, bytes memory result) = request.target.call{
            value: request.value
        }(request.data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /** ERC4337 Validation */

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256) {
        return _validate(userOpHash, userOp.signature);
    }

    function getName() public view override returns(bytes32, bytes32) {
        return _getName();
    }
}
