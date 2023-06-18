//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */

library AuthValidatorStorage {
    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.account.auth.validator');

    address constant VOID = address(0);
    address constant START = address(1);
    address constant END = address(2);

    struct Layout {
        // auth provider => linkded list starting from address(1)
        mapping(bytes32 => mapping(address => address)) validators;
    }

    function layout() internal pure returns(Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }

    function getValidatorsPaginated(
        bytes32 authProvider,
        address start,
        uint256 pageSize
    ) internal view returns(address[] memory result) {
        mapping(address => address) storage s = layout().validators[authProvider];
        result = new address[](pageSize);
        address next = s[start];
        if (start == START && next == VOID) { return result; }
        require(next != VOID, "start node not set");
        for (uint i = 0; i < pageSize && next != END; i++) {
            result[i] = next;
            next = s[next];
        }
        return result;
    }

    function addValidators(
        bytes32 authProvider,
        address[] memory validators
    ) internal {
        mapping(address => address) storage s = layout().validators[authProvider];
        address first = s[START];
        for (uint256 i = 0; i < validators.length; i++) {
            address validator = validators[i];
            require(s[validator] == address(0), "already added");
            if (i == 0) {
                s[START] = validator;
            }
            if (i == validators.length - 1) {
                s[validator] = first == VOID ? END : first;
            } else {
                s[validator] = validators[i + 1];
            }
        }
    }

    function removeValidator(
        bytes32 authProvider,
        address prevKey,
        address key
    ) internal {
        mapping(address => address) storage s = layout().validators[authProvider];
        require(s[prevKey] == key && key != END, "invalid input");
        s[prevKey] = s[key];
        s[key] = VOID;
    }

    function isValidatorEnabled(
        bytes32 authType,
        address validator
    ) internal view returns(bool) {
        return layout().validators[authType][validator] != VOID;
    }
}