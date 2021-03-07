pragma solidity 0.7.6;

/**
 *  _____________________________________________
 * / oooooo   oooooo     oooo ooooo ooooooooo    \
 * |  `888     `888       8'  `888' `888   `Y88  |
 * |   `888     8888     8'    888   888    d88' |
 * |    `888   8'`888   8'     888   888ooo88P'  |
 * |     `888 8'  `888 8'      888   888         |
 * |      `888'    `888'       888   888         |
 * |       `8'      `8'       o888o o888o        |
 * \____________________________________________/
 *        \   ^__^
 *         \  (oo)\_______
 *            (__)\       )\/\
 *                ||----w |
 *                ||     ||
 *
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

import "../Interfaces/Interfaces.sol";
import "../utils/Math.sol";

contract PriceCalculator is IPriceCalculator, Ownable {
    using SafeMath for uint256;
    using HegicMath for uint256;

    uint256[3] public impliedVolRate;
    uint256 internal constant PRICE_DECIMALS = 1e8;
    uint256 internal immutable DECIMALS_DIFF;
    uint256 public utilizationRate = 2e8;
    AggregatorV3Interface public priceProvider;
    IHegicLiquidityPool pool;

    constructor(
        uint256[3] memory initialRates,
        AggregatorV3Interface _priceProvider,
        IHegicLiquidityPool _pool,
        uint8 tokenDecimalsDiff
    ) {
        pool = _pool;
        priceProvider = _priceProvider;
        impliedVolRate = initialRates;
        DECIMALS_DIFF = 10**tokenDecimalsDiff;
    }

    /**
     * @notice Used for adjusting the options prices while balancing asset's implied volatility rate
     * @param values New IVRate values
     */
    function setImpliedVolRate(uint256[3] calldata values) external onlyOwner {
        impliedVolRate = values;
    }

    /**
     * @notice Used for getting the actual options prices
     * @param period Option period in seconds (1 days <= period <= 12 weeks)
     * @param amount Option amount
     * @param strike Strike price of the option
     * @return settlementFee Amount to be distributed to the HEGIC token holders
     * @return premium Option fee amount
     */
    function fees(
        uint256 period,
        uint256 amount,
        uint256 strike,
        IHegicOptions.OptionType optionType
    ) public view override returns (uint256 settlementFee, uint256 premium) {
        uint256 currentPrice = _currentPrice();
        require(
            strike == currentPrice,
            "Only ATM options are currently available"
        );

        settlementFee = getSettlementFee(amount);
        premium = getPeriodFee(amount, period, strike, optionType);
    }

    /**
     * @notice Calculates settlementFee
     * @param amount Option amount
     * @return fee Settlement fee amount
     */
    function getSettlementFee(uint256 amount)
        internal
        pure
        returns (uint256 fee)
    {
        return amount / 100;
    }

    /**
     * @notice Calculates periodFee
     * @param amount Option amount
     * @param period Option period in seconds (1 days <= period <= 12 weeks)
     * @param strike Strike price of the option
     * @return fee Period fee amount
     *
     * amount < 1e30        |
     * impliedVolRate < 1e10| => amount * impliedVolRate * strike < 1e60 < 2^uint256
     * strike < 1e20 ($1T)  |
     *
     * in case amount * impliedVolRate * strike >= 2^256
     * transaction will be reverted by the SafeMath
     */
    function getPeriodFee(
        uint256 amount,
        uint256 period,
        uint256 strike,
        IHegicOptions.OptionType optionType
    ) internal view returns (uint256 fee) {
        if (optionType == IHegicOptions.OptionType.Put)
            return
                amount
                    .mul(_priceModifier(amount, period))
                    .mul(strike)
                    .div(PRICE_DECIMALS)
                    .div(PRICE_DECIMALS)
                    .div(DECIMALS_DIFF);
        else if (optionType == IHegicOptions.OptionType.Call)
            return
                amount
                    .mul(_priceModifier(amount, period))
                    .mul(_currentPrice())
                    .div(strike)
                    .div(PRICE_DECIMALS);
    }

    function _priceModifier(uint256 amount, uint256 period)
        internal
        view
        returns (uint256 iv)
    {
        uint256 poolBalance = pool.totalBalance();
        require(poolBalance > 0, "Pool is empty");

        if (period < 1 weeks) iv = impliedVolRate[0];
        else if (period < 4 weeks) iv = impliedVolRate[1];
        else iv = impliedVolRate[2];
        iv = iv.mul(period.sqrt());
        uint256 utilization =
            (pool.lockedAmount().add(amount)).mul(100e8).div(poolBalance);
        if (utilization > 40e8) {
            uint256 percentAbove =
                (
                    (pool.lockedAmount().add(amount)).mul(100e8).sub(
                        poolBalance.mul(40e8)
                    )
                )
                    .div(amount.mul(100e8));
            if (percentAbove > 1) percentAbove = 1;
            iv += iv
                .mul(utilization.sub(40e8))
                .mul(utilizationRate)
                .div(40e16)
                .mul(percentAbove);
        }
    }

    function _currentPrice() internal view returns (uint256 price) {
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        price = uint256(latestPrice);
    }
}
