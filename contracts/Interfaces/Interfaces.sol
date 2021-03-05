pragma solidity 0.7.6;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Hegic
 * Copyright (C) 2021 Hegic Protocol
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

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";

interface IHegicLiquidityPool {
    struct LockedLiquidity {
        uint256 amount;
        uint256 hedgePremium;
        uint256 unhedgePremium;
        bool locked;
    }
    struct Tranche {
        TrancheState state;
        uint256 share;
        uint256 amount;
        uint256 creationTimestamp;
        bool hedged;
    }
    enum TrancheState {Invalid, Open, Closed}

    event Profit(
        uint256 indexed id,
        uint256 hedgeAmount,
        uint256 unhedgeAmount
    );
    event Loss(uint256 indexed id, uint256 hedgeAmount, uint256 unhedgeAmount);
    event Provide(
        address indexed account,
        uint256 amount,
        uint256 writeAmount,
        bool hedging
    );
    event Withdraw(address indexed account, uint256 tranchesID);

    function lock(uint256 amount, uint256 premium)
        external
        returns (uint256 id);

    function unlock(uint256 id) external;

    function send(
        uint256 id,
        address account,
        uint256 amount
    ) external;

    function setLockupPeriod(uint256 value) external;

    function setHedgePool(address value) external;

    function totalBalance() external view returns (uint256 amount);

    function lockedAmount() external view returns (uint256 amount);

    function token() external view returns (IERC20);

    function provideFrom(
        address account,
        uint256 amount,
        bool hedging,
        uint256 minShare
    ) external returns (uint256 share);

    function withdraw(uint256 trancheID) external returns (uint256 amount);

    function withdrawWithoutHedge(uint256 trancheID)
        external
        returns (uint256 amount);

    function lockedLiquidity(uint256 id)
        external
        view
        returns (
            uint256 amount,
            uint256 hedgePremium,
            uint256 unhedgePremium,
            bool locked
        );
    // function unlockPremium(uint256 amount) external;
}

interface IHegicStaking {
    event Claim(address indexed acount, uint256 amount);
    event Profit(uint256 amount);

    function claimProfit() external returns (uint256 profit);

    function buy(uint256 amount) external;

    function sell(uint256 amount) external;

    function profitOf(address account) external view returns (uint256);

    function sendProfit(uint256 amount) external;
}

interface IHegicOptions is IERC721 {
    event Create(
        uint256 indexed id,
        address indexed account,
        uint256 settlementFee,
        uint256 premium
    );
    event Exercise(uint256 indexed id, uint256 profit);
    event Expire(uint256 indexed id);
    enum State {Inactive, Active, Exercised, Expired}
    enum OptionType {Invalid, Put, Call}

    struct Option {
        State state;
        uint256 strike;
        uint256 amount;
        // uint256 lockedAmount;
        // uint256 premium;
        uint256 expiration;
        OptionType optionType;
        uint256 lockedLiquidityID;
    }

    function createFor(
        address account,
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    ) external returns (uint256 optionID);

    function options(uint256)
        external
        view
        returns (
            State state,
            uint256 strike,
            uint256 amount,
            // uint256 lockedAmount,
            // uint256 premium,
            uint256 expiration,
            OptionType optionType,
            uint256 lockedLiquidityID
        );
}

interface IPriceCalculator {
    function fees(
        uint256 period,
        uint256 amount,
        uint256 strike,
        IHegicOptions.OptionType optionType
    ) external view returns (uint256 settlementFee, uint256 premium);
}

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 value) external;
}
