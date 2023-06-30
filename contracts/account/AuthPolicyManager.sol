//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./AuthFactorManager.sol";
import "../interfaces/IRiskEngine.sol";

library AuthPolicyStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256("hexlink.account.auth.policy");

    struct Layout {
        address riskEngine;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract AuthPolicyManager is AuthFactorManager {
    using ECDSA for bytes32;

    function getRiskEngine() public view returns (address) {
        return AuthPolicyStorage.layout().riskEngine;
    }

    function _validateAuthFactors(
        bytes32 userOpHash,
        bytes calldata signature
    ) internal returns (uint256 result) {
        bytes32 message = userOpHash.toEthSignedMessageHash();
        if (_isSecondFactorEnabled()) {
            (
                AuthInput memory first,
                AuthInput memory second,
                RiskAssertion memory risk
            ) = abi.decode(signature, (AuthInput, AuthInput, RiskAssertion));
            result = _validateFirstFactor(message, first);
            if (result == 0 && _requireStepUp(message, risk)) {
                result = _validateSecondFactor(message, second);
            }
        } else {
            (AuthInput memory input) = abi.decode(signature, (AuthInput));
            result = _validateFirstFactor(message, input);
        }
    }

    function _requireStepUp(
        bytes32 message,
        RiskAssertion memory risk
    ) internal returns (bool) {
        address engine = AuthPolicyStorage.layout().riskEngine;
        return
            engine == address(0) || IRiskEngine(engine).assess(message, risk);
    }
}
