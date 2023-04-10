//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

import "@solidstate/contracts/access/ownable/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./ISwap.sol";

contract HexlinkSwapImpl is Ownable, UUPSUpgradeable, ISwap {
    using ECDSA for bytes32;

    event Deposit(address sender, uint256 amount);
    event Withdraw(address receiver, uint256 amount);

    mapping(address => uint256) prices_; // amount token T per ETH
    
    function init(address newOwner) external {
        require(owner() == address(0), "already initialized");
        _transferOwnership(newOwner);
    }

    function setPrice(address token, uint256 price) external onlyOwner {
         prices_[token] = price;
    }

    function setPrices(address[] memory tokens, uint256[] memory prices) external onlyOwner {
        require(tokens.length == prices.length, "args length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            prices_[tokens[i]] = prices[i];
        }
    }

    function withdraw(uint256 amount) external onlyOwner {
        address owner = owner();
        emit Withdraw(owner, amount);
        Address.sendValue(payable(owner), amount);
    }

    function priceOf(address token) external override view returns(uint256) {
        return prices_[token];
    }

    function deposit() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function swap(
        address token,
        uint256 amountIn
    ) external override returns(uint256 amountOut) {
        amountOut = _swap(token, amountIn);
        Address.sendValue(payable(msg.sender), amountOut);
    }

    function swapAndCall(
        address token,
        uint256 amountIn,
        address to,
        bytes memory data
    ) external override returns(uint256 amountOut) {
        amountOut = _swap(token, amountIn);
        (bool success, bytes memory returndata) = to.call{value: amountOut}(data);
        Address.verifyCallResult(success, returndata, "call error");
    }

    function swapExactOutput(
        address token,
        uint256 amountOut
    ) external returns(uint256 amountIn) {
        amountIn = _swapExactOutput(token, amountOut);
        Address.sendValue(payable(msg.sender), amountOut);
    }

    function swapExactOutputAndCall(
        address token,
        uint256 amountOut,
        address to,
        bytes memory data
    ) external returns(uint256 amountIn) {
        amountIn = _swapExactOutput(token, amountOut);
        (bool success, bytes memory returndata) = to.call{value: amountOut}(data);
        Address.verifyCallResult(success, returndata, "call error");
    }

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _swap(address token, uint256 amountIn) internal returns(uint256 amountOut){
        uint256 price = _validateInput(token, amountIn);
        amountOut = amountIn * 1000000000000000000 / price;
        require(address(this).balance >= amountOut, "Low liquidity");
        emit Swap(msg.sender, token, amountIn, amountOut);
    }

    function _swapExactOutput(address token, uint256 amountOut) internal returns(uint256 amountIn) {
        require(address(this).balance >= amountOut, "Low liquidity");
        uint256 price = _validateInput(token, amountIn);
        amountIn = amountOut * price / 1000000000000000000 + 1;
        emit Swap(msg.sender, token, amountIn, amountOut);
    }

    function _validateInput(address token, uint256 amountIn) internal returns(uint256 price) {
        address owner = owner();
        IERC20(token).transferFrom(msg.sender, owner, amountIn);
        price = prices_[token];
        require(price > 0, "unsupported token");
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }
}

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract HexlinkSwapProxy is ERC1967Proxy {
    constructor(
        address logic,
        bytes memory data
    ) ERC1967Proxy(logic, data) payable {}
}