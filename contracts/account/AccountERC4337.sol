//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "./eip4337/BaseWallet.sol";
import "./eip4337/UserOperation.sol";
import "./AccountBase.sol";
import "../utils/Initializable.sol";

contract AccountERC4337 is AccountBase, BaseWallet, Initializable {
    event SetEntryPoint(address indexed newEntryPoint);

    struct AppStorage {
        address entryPoint;
        uint256 nonce;
    }
    AppStorage internal s;

    function init(address owner, address _entryPoint) external initializer {
        OwnableStorage.layout().owner = owner;
        s.entryPoint = _entryPoint;
    }

    function nonce() public view virtual returns (uint256) {
        return s.nonce;
    }

    function entryPoint() public view override virtual returns (address) {
        return s.entryPoint;
    }

    function updateEntryPoint(address newEntryPoint) onlyEntryPoint external {
        s.entryPoint = newEntryPoint;
        emit SetEntryPoint(newEntryPoint);
    }

    function _validateAndUpdateNonce(UserOperation calldata userOp) internal override virtual {
        require(s.nonce++ == userOp.nonce, "HEXLA005");
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 requestId, address)
    internal override returns (uint256) {
        _validateSignature(requestId, userOp.signature);
        return 0;
    }

    function _validateCaller() internal override {
        require(msg.sender == entrypoint() || msg.sender == owner(), "HEXLA013");
    }
}
