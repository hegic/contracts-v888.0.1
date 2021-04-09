pragma solidity 0.8.3;
/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Hegic
 * Copyright (C) 2020 Hegic
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import "./ERC20Mock.sol";
import "@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol";

contract UniswapRouterMock {
    ERC20Mock immutable WBTC;
    ERC20Mock immutable USDC;
    AggregatorV3Interface public immutable WBTCPriceProvider;
    AggregatorV3Interface public immutable ETHPriceProvider;

    constructor(
        ERC20Mock _WBTC,
        ERC20Mock _USDC,
        AggregatorV3Interface WPP,
        AggregatorV3Interface EPP
    ) {
        WBTC = _WBTC;
        USDC = _USDC;
        WBTCPriceProvider = WPP;
        ETHPriceProvider = EPP;
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require(path.length == 2, "UniswapMock: wrong path");
        require(
            path[1] == address(USDC) || path[1] == address(WBTC),
            "UniswapMock: too small value"
        );
        amounts = getAmountsIn(amountOut, path);
        require(msg.value >= amounts[0], "UniswapMock: too small value");
        if (msg.value > amounts[0])
            payable(msg.sender).transfer(msg.value - amounts[0]);
        ERC20Mock(path[1]).mintTo(to, amountOut);
    }

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length == 2, "UniswapMock: wrong path");
        uint256 amount;
        if (path[1] == address(USDC)) {
            (, int256 ethPrice, , , ) = ETHPriceProvider.latestRoundData();
            amount = (amountOut * 1e8) / uint256(ethPrice);
        } else if (path[1] == address(WBTC)) {
            (, int256 ethPrice, , , ) = ETHPriceProvider.latestRoundData();
            (, int256 wbtcPrice, , , ) = WBTCPriceProvider.latestRoundData();
            amount = (amountOut * uint256(wbtcPrice)) / uint256(ethPrice);
        } else revert("UniswapMock: wrong path");

        amounts[0] = (amount * 103) / 100;
        amounts[1] = amountOut;
    }

    // function factory() external pure returns (address);
    // function WETH() external pure returns (address);

    // function addLiquidity(
    //     address tokenA,
    //     address tokenB,
    //     uint amountADesired,
    //     uint amountBDesired,
    //     uint amountAMin,
    //     uint amountBMin,
    //     address to,
    //     uint deadline
    // ) external returns (uint amountA, uint amountB, uint liquidity);
    // function addLiquidityETH(
    //     address token,
    //     uint amountTokenDesired,
    //     uint amountTokenMin,
    //     uint amountETHMin,
    //     address to,
    //     uint deadline
    // ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    // function removeLiquidity(
    //     address tokenA,
    //     address tokenB,
    //     uint liquidity,
    //     uint amountAMin,
    //     uint amountBMin,
    //     address to,
    //     uint deadline
    // ) external returns (uint amountA, uint amountB);
    // function removeLiquidityETH(
    //     address token,
    //     uint liquidity,
    //     uint amountTokenMin,
    //     uint amountETHMin,
    //     address to,
    //     uint deadline
    // ) external returns (uint amountToken, uint amountETH);
    // function removeLiquidityWithPermit(
    //     address tokenA,
    //     address tokenB,
    //     uint liquidity,
    //     uint amountAMin,
    //     uint amountBMin,
    //     address to,
    //     uint deadline,
    //     bool approveMax, uint8 v, bytes32 r, bytes32 s
    // ) external returns (uint amountA, uint amountB);
    // function removeLiquidityETHWithPermit(
    //     address token,
    //     uint liquidity,
    //     uint amountTokenMin,
    //     uint amountETHMin,
    //     address to,
    //     uint deadline,
    //     bool approveMax, uint8 v, bytes32 r, bytes32 s
    // ) external returns (uint amountToken, uint amountETH);
    // function swapExactTokensForTokens(
    //     uint amountIn,
    //     uint amountOutMin,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external returns (uint[] memory amounts);
    // function swapTokensForExactTokens(
    //     uint amountOut,
    //     uint amountInMax,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external returns (uint[] memory amounts);
    // function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
    //     external
    //     payable
    //     returns (uint[] memory amounts);
    // function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
    //     external
    //     returns (uint[] memory amounts);
    // function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
    //     external
    //     returns (uint[] memory amounts);
    // function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
    //     external
    //     payable
    //     returns (uint[] memory amounts);
    //
    // function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
    // function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    // function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    // function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}
