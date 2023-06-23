//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "./AuthFactorManager.sol";
import "./auth/risk/IRiskEngine.sol";
import "./structs.sol";

library AuthPolicyStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.policy');
 
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
    function setRiskEngine(address riskEngine) external onlySelf {
        AuthPolicyStorage.layout().riskEngine = riskEngine;
    }

    function getRiskEngine() external view returns(address) {
        return AuthPolicyStorage.layout().riskEngine;
    }

    function _stepUp(
        UserRequest memory request,
        bytes32 requestHash,
        RequestContext calldata ctx
    ) internal {
        address engine = AuthPolicyStorage.layout().riskEngine;
        if (engine != address(0)) {
            bool requireStepUp = IRiskEngine(engine).assess(request, requestHash, ctx.risk);
            if (requireStepUp && _isSecondFactorEnabled()) {
                _validateSecondFactor(requestHash, ctx.auth);
            }
        }
    }
}
