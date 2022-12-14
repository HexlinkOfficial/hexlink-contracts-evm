// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IIdentityOracleRegistry.sol";
import "./AuthProof.sol";

struct PrevAuthProof {
    uint256 verifiedAt;
    bytes32 identityType;
}

struct RequestInfo {
    bytes32 name;
    bytes32 requestId;
    address account;
    uint96 nonce;
}

library HexlinkAuthStorage {
    struct Layout {
        address oracle;
        // name => request id => prev auth proof
        mapping(bytes32 => mapping(bytes32 => PrevAuthProof)) proofs;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256('hexlink.contracts.storage.HexlinkAuthStorage');

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}

abstract contract HexlinkAuth {
    using Address for address;

    uint256 constant public twoStageLock = 259200;
    uint256 constant public ttl = 259200;

    function oracleRegistry() public view returns(address) {
        return HexlinkAuthStorage.layout().oracle;
    }

    function _setOracleRegistry(address registry) internal {
        require(registry != address(0), "HEXL020");
        HexlinkAuthStorage.layout().oracle = registry;
    }

    function _validate(
        RequestInfo memory info,
        AuthProof calldata proof
    ) internal view {
        require(_isValid1stFac(proof), "HEXL003");
        _validateAuthProof(info, proof);
    }

    function _validate2Fac(
        RequestInfo memory info,
        AuthProof calldata proof1, // from oracle
        AuthProof calldata proof2 // from account
    ) internal view {
        _validate(info, proof1);
        require(_isValid2ndFac(proof2), "HEXL004");
        //[first factor, second factor], order matters
        _validateAuthProof(info, proof2);
    }

    function _validate2Stage(
        RequestInfo memory info,
        AuthProof calldata proof
    ) internal returns(uint256) {
        HexlinkAuthStorage.Layout storage s = HexlinkAuthStorage.layout();
        PrevAuthProof memory prev = s.proofs[info.name][info.requestId];
        if (prev.verifiedAt == 0) { // stage 1
            _validate(info, proof);
            s.proofs[info.name][info.requestId].verifiedAt = block.timestamp;
            s.proofs[info.name][info.requestId].identityType = proof.identityType;
            return 1;
        } else { // stage 2
            if (!_isValid2ndFac(proof)) {
                require(
                    block.timestamp > prev.verifiedAt + twoStageLock,
                    "HEXL005"
                );
            } // else 2-fac
            _validateAuthProof(info, proof);
            return 2;
        }
    }

    function _validateAuthProof(
        RequestInfo memory info,
        AuthProof calldata proof
    ) internal view {
        require(
            proof.issuedAt < block.timestamp && proof.issuedAt + ttl > block.timestamp,
            "HEXL006"
        );
        bytes32 message = keccak256(
            abi.encode(
                info.name,
                info.requestId,
                proof.issuedAt,
                proof.identityType,
                proof.authType
            )
        );
        address validator = proof.identityType == 0 ? info.account : _oracle(proof);
        try IERC1271(validator).isValidSignature(
            message, proof.signature
        ) returns (bytes4 returnvalue) {
            require(returnvalue == IERC1271.isValidSignature.selector, "HEXL007");
        } catch Error(string memory reason) {
            revert(reason);
        } catch {
            revert("HEXL008");
        }
    }

    function _oracle(AuthProof calldata proof) private view returns(address) {
        OracleSelector memory selector
            = OracleSelector(proof.identityType, proof.authType);
        address oracle = IIdentityOracleRegistry(
            HexlinkAuthStorage.layout().oracle
        ).oracle(selector);
        require(oracle != address(0), "HEXL017");
        return oracle;
    }

    // in current impl we only allow proof from
    // oracle as first factor
    function _isValid1stFac(
        AuthProof calldata proof
    ) internal pure returns(bool) {
        return proof.identityType != 0;
    }

    // in current impl we only allow proof from
    // account admin as second factor
    function _isValid2ndFac(
        AuthProof calldata proof
    ) internal pure returns(bool) {
        return proof.identityType == 0;
    }
}
