// SPDX-License-Identifier: MIT
// Hexlink Contracts

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Strings.sol";
import '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import "../../../interfaces/IAuthProvider.sol";
import "../../../utils/Constants.sol";
import "../../../interfaces/IERC4972.sol";

contract EnsAuthProvider is IAuthProvider, Constants {
    ENS immutable ens;

    constructor(address ens_) {
        ens = ENS(ens_);
    }

    function getValidator(address account) public view override returns(address) {
        bytes32 nameType = IERC4972Account(account).getNameType();
        return nameType == ENS_NAME
            ? ens.owner(IERC4972Account(account).getName())
            : address(0);
    }

    function getNameService() external view returns(address) {
        return address(ens);
    }

    function getDefaultValidator() public pure returns(address) {
        return address(0);
    }

    function getMetadata() external pure override returns(string memory) {
        return "";
    }
}