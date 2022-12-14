//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "./IERC4337Wallet.sol";
import "./UserOperation.sol";

/* solhint-disable avoid-low-level-calls */
/* solhint-disable reason-string */

/**
 * Basic wallet implementation.
 * this contract provides the basic logic for implementing the IWallet interface  - validateUserOp
 * specific wallet implementation should inherit it and provide the wallet-specific logic
 */
abstract contract BaseWallet is IWallet {
    using LibUserOperation for UserOperation;

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint(), "HEXLA006");
        _;
    }

    function entryPoint() public view virtual returns (address);

    /**
     * Validate user's signature and nonce.
     * subclass doesn't need to override this method. Instead, it should override the specific internal validation methods.
     */
    function validateUserOp(UserOperation calldata userOp, bytes32 requestId, address aggregator, uint256 missingWalletFunds)
    external onlyEntryPoint override virtual returns (uint256 deadline) {
        deadline = _validateSignature(userOp, requestId, aggregator);
        if (userOp.initCode.length == 0) {
            _validateAndUpdateNonce(userOp);
        }
        _payPrefund(missingWalletFunds);
    }

    /**
     * validate the signature is valid for this message.
     * @param userOp validate the userOp.signature field
     * @param requestId convenient field: the hash of the request, to check the signature against
     *          (also hashes the entrypoint and chain-id)
     * @param aggregator the current aggregator. can be ignored by wallets that don't use aggregators
     * @return deadline the last block timestamp this operation is valid, or zero if it is valid indefinitely.
     *      Note that the validation code cannot use block.timestamp (or block.number) directly.
     */
    function _validateSignature(UserOperation calldata userOp, bytes32 requestId, address aggregator)
    internal virtual returns (uint256 deadline);

    /**
     * validate the current nonce matches the UserOperation nonce.
     * then it should update the wallet's state to prevent replay of this UserOperation.
     * called only if initCode is empty (since "nonce" field is used as "salt" on wallet creation)
     * @param userOp the op to validate.
     */
    function _validateAndUpdateNonce(UserOperation calldata userOp) internal virtual;

    /**
     * sends to the entrypoint (msg.sender) the missing funds for this transaction.
     * subclass MAY override this method for better funds management
     * (e.g. send to the entryPoint more than the minimum required, so that in future transactions
     * it will not be required to send again)
     * @param missingWalletFunds the minimum value this method should send the entrypoint.
     *  this value MAY be zero, in case there is enough deposit, or the userOp has a paymaster.
     */
    function _payPrefund(uint256 missingWalletFunds) internal virtual {
        if (missingWalletFunds != 0) {
            (bool success,) = payable(msg.sender).call{
                value : missingWalletFunds,
                gas : type(uint256).max
            }("");
            (success);
            //ignore failure (its EntryPoint's job to verify, not wallet.)
        }
    }
}