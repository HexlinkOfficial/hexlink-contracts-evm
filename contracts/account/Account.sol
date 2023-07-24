//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IExecutable.sol";
import "./base/ERC4337Account.sol";
import "./base/ERC4972Account.sol";
import "./base/ERC6662Account.sol";
import "./AuthFactorManager.sol";

contract Account is
    Initializable,
    IExecutable,
    ERC4337Account,
    ERC4972Account,
    ERC6662Account,
    AuthFactorManager,
    UUPSUpgradeable
{
    using Address for address;

    error UnAuthorizedUpgrade();

    constructor(
        address entryPoint,
        address erc4972Registry,
        address nameService,
        address authRegistry
    ) ERC4337Account(entryPoint)
      ERC4972Account(erc4972Registry, nameService)
      ERC6662Account(authRegistry) { }

    function initialize(
        bytes32 name,
        address owner
    ) public initializer {
         _setName(name);
        _initFirstFactor(owner);
    }

    /** IExectuable */

    function execute(
        UserRequest calldata request
    ) onlyEntryPoint onlyValidFirstFactor external payable override {
        _call(request);
    }

    function executeBatch(
        UserRequest[] calldata requests
    ) onlyEntryPoint onlyValidFirstFactor external payable override {
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

    /** UUPSUpgradeable */

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) onlySelf internal view override {
        address nameService = address(getNameService());
        if (newImplementation != factory_.getAccountImplementation(nameService)) {
            revert UnAuthorizedUpgrade();
        }
    }
}
