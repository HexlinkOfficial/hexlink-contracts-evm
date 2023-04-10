//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.12;

interface ISwap {
    event Swap(address indexed from, address indexed token, uint256 amountIn, uint256 amountOut);

    function priceOf(address token) external view returns(uint256);

    function swap(
        address token,
        uint256 amountIn
    ) external returns(uint256 amountOut);

    function swapExactOutput(
        address token,
        uint256 amountOutput
    ) external returns(uint256 amountIn);

    function swapAndCall(
        address token,
        uint256 amountIn,
        address to,
        bytes memory data
    ) external returns(uint256 amountOut);

    function swapExactOutputAndCall(
        address token,
        uint256 amountOutput,
        address to,
        bytes memory data
    ) external returns(uint256 amountIn);
}