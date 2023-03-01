// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IIdentityOracleRegistry.sol";

contract IdentityOracleRegistry is IIdentityOracleRegistry, Ownable {
    using Address for address;

    event Register(
        OracleSelector selector,
        address oracle
    );

    event RegisterBatch(
        OracleSelector[] selectors,
        address[] oracles
    );

    mapping(bytes32 => address) private oracles_;

    constructor(
        address owner,
        OracleSelector[] memory selectors,
        address[] memory oracles
    ) {
        _transferOwnership(owner);
        _registerBatch(selectors, oracles);
    }

    function oracle(
        OracleSelector memory selector
    ) public view override returns (address) {
        return oracles_[_lookUpKey(selector)];
    }

    function register(
        OracleSelector memory selector,
        address _oracle
    ) external onlyOwner {
        _register(selector, _oracle);
        emit Register(selector, _oracle);
    }

    function registerBatch(
        OracleSelector[] memory selectors,
        address[] memory oracles
    ) external onlyOwner {
        _registerBatch(selectors, oracles);
        emit RegisterBatch(selectors, oracles);
    }

    function _register(
        OracleSelector memory selector,
        address _oracle
    ) internal {
        require(selector.identityType != bytes32(0) && _oracle != address(0), "HEXL002");
        require(_oracle.isContract(), "HEXL013");
        oracles_[_lookUpKey(selector)] = _oracle;
    }

    function _registerBatch(
        OracleSelector[] memory selectors,
        address[] memory oracles
    ) internal {
        require(selectors.length == oracles.length, "HEXL001");
        for (uint256 i = 0; i < oracles.length; i++) {
            _register(selectors[i], oracles[i]);
        }
    }

    function _lookUpKey(
        OracleSelector memory selector
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(selector));
    }
}