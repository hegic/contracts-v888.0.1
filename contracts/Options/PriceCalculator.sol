pragma solidity 0.8.3;

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
    uint256 internal constant PRICE_MODIFIER_DECIMALS = 1e8;
    uint256 internal immutable DECIMALS_DIFF;
    uint256 public constant UTILIZATION_RATE = 1e8;
    AggregatorV3Interface public immutable priceProvider;
    IHegicLiquidityPool immutable assetPool;
    IHegicLiquidityPool immutable stablePool;

    constructor(
        uint256[3] memory initialRates,
        AggregatorV3Interface _priceProvider,
        IHegicLiquidityPool _assetPool,
        IHegicLiquidityPool _stablePool,
        uint8 tokenDecimalsDiff
    ) {
        assetPool = _assetPool;
        stablePool = _stablePool;
        priceProvider = _priceProvider;
        impliedVolRate = initialRates;
        DECIMALS_DIFF = 10 ** tokenDecimalsDiff;
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
        
        // NOTE: this is enforced here to be able to increase period in the future without upgrading main contracts
        require(period >= 1 days, "Period is too short");
        require(period <= 12 weeks, "Period is too long");
        
        require(
            strike == currentPrice || strike == 0,
            "Only ATM options are currently available"
        );
        return (
            getSettlementFee(amount, optionType, currentPrice),
            getPeriodFee(amount, period, currentPrice, optionType)
        );
    }

    /**
     * @notice Calculates settlementFee
     * @param amount Option amount
     * @return fee Settlement fee amount
     */
    function getSettlementFee(
        uint256 amount,
        IHegicOptions.OptionType optionType,
        uint256 currentPrice
    ) internal pure returns (uint256 fee) {
        if (optionType == IHegicOptions.OptionType.Call) return amount / 100;
        if (optionType == IHegicOptions.OptionType.Put)
            return (amount * currentPrice) / PRICE_DECIMALS / 100;
    }

    /**
     * @notice Calculates periodFee
     * @param amount Option amount
     * @param period Option period in seconds (1 days <= period <= 12 weeks)
     * @return fee Period fee amount
     */

    function getPeriodFee(
        uint256 amount,
        uint256 period,
        uint256 currentPrice,
        IHegicOptions.OptionType optionType
    ) internal view returns (uint256 fee) {
        if (optionType == IHegicOptions.OptionType.Put)
            return
                (amount *
                    currentPrice *
                    _priceModifier(amount, period, stablePool)) /
                PRICE_MODIFIER_DECIMALS /
                PRICE_DECIMALS /
                DECIMALS_DIFF;
        if (optionType == IHegicOptions.OptionType.Call)
            return
                (amount * _priceModifier(amount, period, assetPool)) /
                PRICE_DECIMALS;
    }

    function _priceModifier(
        uint256 amount,
        uint256 period,
        IHegicLiquidityPool pool
    ) internal view returns (uint256 iv) {
        uint256 poolBalance = pool.totalBalance();
        require(poolBalance > 0, "Pool is empty");

        if (period < 1 weeks) iv = impliedVolRate[0];
        else if (period < 4 weeks) iv = impliedVolRate[1];
        else iv = impliedVolRate[2];

        iv *= period.sqrt();

        uint256 lockedAmount = pool.lockedAmount() + amount;
        uint256 utilization = (lockedAmount * 100e8) / poolBalance;

        if (utilization > 40e8) {
            iv += (iv * (utilization - 40e8) * UTILIZATION_RATE) / 40e16;
        }
    }

    function _currentPrice() internal view returns (uint256 price) {
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        price = uint256(latestPrice);
    }
}
