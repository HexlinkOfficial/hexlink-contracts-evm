//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

/* solhint-disable avoid-low-level-calls */

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";

abstract contract AccountBase is IERC1271, Ownable {
    using ECDSA for bytes32;

    struct BasicUserOp {
        address to;
        uint256 value;
        bytes callData;
        uint256 callGasLimit;
    }

    using Address for address;

    receive() external payable { }

    fallback(bytes calldata) external returns (bytes memory) {
        // for ERC1155 and ERC3525
        return abi.encode(msg.sig);
    }

    function isValidSignature(
        bytes32 message,
        bytes calldata signature
    ) external override view returns(bytes4) {
        _validateSignature(message, signature);
        return IERC1271.isValidSignature.selector;
    }

    function execBatch(BasicUserOp[] calldata ops) external {
        _validateCaller();
        uint256 opsLen = ops.length;
        for (uint256 i = 0; i < opsLen; i++) {
            _exec(ops[i]);
        }
    }

    function exec(BasicUserOp calldata op) external {
        _validateCaller();
        _exec(op);
    }

    function _exec(BasicUserOp calldata op) internal {
        (
            bool success,
            bytes memory data
        ) = op.to.call{value: op.value, gas: op.callGasLimit}(op.callData);
        op.to.verifyCallResultFromTarget(success, data, "HEXLA001");
    }

    function _validateSignature(bytes32 message, bytes calldata signature) internal view {
        address signer = owner();
        bytes32 reqHash = message.toEthSignedMessageHash();
        if (Address.isContract(signer)) {
            try IERC1271(signer).isValidSignature(reqHash, signature) returns (bytes4 returnvalue) {
                require(returnvalue == IERC1271.isValidSignature.selector, "HEXLA002");
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("HEXLA003");
            }
        } else {
            require(signer == reqHash.recover(signature), "HEXLA004");
        }
    }

    function _validateCaller() internal virtual;
}
