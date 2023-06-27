//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

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
    function setRiskEngine(address riskEngine) external onlySelf {
        AuthPolicyStorage.layout().riskEngine = riskEngine;
    }

    function getRiskEngine() public view returns (address) {
        return AuthPolicyStorage.layout().riskEngine;
    }

    function _stepUp(
        UserRequest memory request,
        bytes32 requestHash,
        RequestContext calldata ctx
    ) internal {
        require(_isSecondFactorEnabled(), "no step up enabled");
        address engine = AuthPolicyStorage.layout().riskEngine;
        if (
            engine == address(0) ||
            IRiskEngine(engine).assess(request, requestHash, ctx.risk)
        ) {
            _validateSecondFactor(requestHash, ctx.auth);
        }
    }
}
