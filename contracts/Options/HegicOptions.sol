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

import "../Interfaces/Interfaces.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @author 0mllwntrmt3
 * @title Hegic Bidirectional (Call and Put) Options
 * @notice Hegic Protocol Options Contract
 */

contract HegicOptions is Ownable, IHegicOptions, ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 internal immutable BASE_TOKEN_DECIMALS; // / 1e18;
    uint256 internal immutable STABLE_TOKEN_DECIMALS; // / 1e6;
    uint256 internal constant PRICE_DECIMALS = 1e8;
    // uint256 internal constant BETA_PERIOD = 14 days; // base
    uint256 internal constant BETA_PERIOD = 360 days; // beta
    uint256 internal immutable CONTRACT_CREATED = block.timestamp;

    Option[] public override options;

    AggregatorV3Interface public priceProvider;
    mapping(OptionType => IHegicLiquidityPool) public pool;
    mapping(OptionType => IHegicStaking) public settlementFeeRecipient;
    mapping(OptionType => IERC20) public token;
    IPriceCalculator public priceCalculator;

    /**
     * @param _priceProvider The address of ChainLink price feed contract
     * @param _token The address of main token contract (WETH or WBTC)
     */
    constructor(
        AggregatorV3Interface _priceProvider,
        IHegicLiquidityPool liquidityPool,
        IHegicLiquidityPool _stablePool,
        IHegicStaking putSettlementFeeRecipient,
        IHegicStaking callSettlementFeeRecipient,
        ERC20 _token,
        ERC20 _stable,
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        pool[OptionType.Call] = liquidityPool;
        pool[OptionType.Put] = _stablePool;
        settlementFeeRecipient[OptionType.Call] = callSettlementFeeRecipient;
        settlementFeeRecipient[OptionType.Put] = putSettlementFeeRecipient;
        token[OptionType.Call] = _token;
        token[OptionType.Put] = _stable;
        priceProvider = _priceProvider;
        approve();

        uint256 baseDecimals = _token.decimals();
        uint256 stableDecimals = _stable.decimals();
        uint256 diff =
            baseDecimals > stableDecimals
                ? baseDecimals - stableDecimals
                : stableDecimals - baseDecimals;
        baseDecimals -= diff;
        stableDecimals -= diff;
        BASE_TOKEN_DECIMALS = 10**baseDecimals;
        STABLE_TOKEN_DECIMALS = 10**stableDecimals;
    }

    /**
     * @notice Can be used to update the contract in critical situations
     *         in the first 14 days after deployment
     */
    function transferPoolsOwnership() external onlyOwner {
        require(block.timestamp < CONTRACT_CREATED + BETA_PERIOD);
        Ownable(address(pool[OptionType.Call])).transferOwnership(owner());
        Ownable(address(pool[OptionType.Put])).transferOwnership(owner());
    }

    /**
     * @notice Used for changing settlementFeeRecipient
     * @param recipientPut  New settlementFee recipient address
     * @param recipientCall New settlementFee recipient address
     */
    function updateSettlementFeeRecipients(
        IHegicStaking recipientPut,
        IHegicStaking recipientCall
    ) external onlyOwner {
        require(address(recipientPut) != address(0));
        require(address(recipientCall) != address(0));
        settlementFeeRecipient[OptionType.Put] = recipientPut;
        settlementFeeRecipient[OptionType.Call] = recipientCall;
    }

    function updatePriceCalculator(IPriceCalculator pc) external onlyOwner {
        priceCalculator = pc;
    }

    /**
     * @notice Creates a new option
     * @param period Option period in seconds (1 days <= period <= 12 weeks)
     * @param amount Option amount
     * @param strike Strike price of the option
     * @param optionType Call or Put option type
     * @return optionID Created option's ID
     */
    function createFor(
        address account,
        uint256 period,
        uint256 amount,
        uint256 strike,
        OptionType optionType
    ) external override returns (uint256 optionID) {
        if (strike == 0) strike = _currentPrice();
        require(period >= 1 days, "Period is too short");
        require(period <= 12 weeks, "Period is too long");

        require(
            optionType == OptionType.Call || optionType == OptionType.Put,
            "Wrong option type"
        );

        if (optionType == OptionType.Call)
            return _createCall(account, period, amount, strike);
        if (optionType == OptionType.Put)
            return _createPut(account, period, amount, strike);
    }

    function _createCall(
        address account,
        uint256 period,
        uint256 amount,
        uint256 strike
    ) internal returns (uint256 optionID) {
        (uint256 settlementFee, uint256 premium) =
            priceCalculator.fees(period, amount, strike, OptionType.Call);

        token[OptionType.Call].safeTransferFrom(
            msg.sender,
            address(this),
            settlementFee.add(premium)
        );
        settlementFeeRecipient[OptionType.Call].sendProfit(settlementFee);

        uint256 lockedAmount = amount;
        optionID = options.length;
        uint256 lockedLiquidityID =
            pool[OptionType.Call].lock(lockedAmount, premium);

        options.push(
            Option(
                State.Active,
                strike,
                amount,
                block.timestamp + period,
                OptionType.Call,
                lockedLiquidityID
            )
        );

        _safeMint(account, optionID);
        emit Create(optionID, account, settlementFee, premium);
    }

    function _createPut(
        address account,
        uint256 period,
        uint256 amount,
        uint256 strike
    ) internal returns (uint256 optionID) {
        (uint256 settlementFee, uint256 premium) =
            priceCalculator.fees(period, amount, strike, OptionType.Put);
        uint256 lockedAmount =
            amount
                .mul(strike)
                .mul(BASE_TOKEN_DECIMALS)
                .div(STABLE_TOKEN_DECIMALS)
                .div(PRICE_DECIMALS);

        optionID = options.length;
        uint256 lockedLiquidityID =
            pool[OptionType.Put].lock(lockedAmount, premium);

        options.push(
            Option(
                State.Active,
                strike,
                amount,
                block.timestamp + period,
                OptionType.Put,
                lockedLiquidityID
            )
        );

        token[OptionType.Put].safeTransferFrom(
            msg.sender,
            address(this),
            settlementFee.add(premium)
        );
        settlementFeeRecipient[OptionType.Put].sendProfit(settlementFee);

        _safeMint(account, optionID);
        emit Create(optionID, account, settlementFee, premium);
    }

    /**
     * @notice Exercises an active option
     * @param optionID ID of your option
     */
    function exercise(uint256 optionID) external {
        Option storage option = options[optionID];

        require(
            _isApprovedOrOwner(msg.sender, optionID),
            "msg.sender can't exercise this option"
        );
        require(option.expiration >= block.timestamp, "Option has expired");
        require(option.state == State.Active, "Wrong state");

        option.state = State.Exercised;
        uint256 profit = payProfit(optionID);

        emit Exercise(optionID, profit);
    }

    /**
     * @notice Allows the ERC pool contract to receive and send tokens
     */
    function approve() public {
        token[OptionType.Call].safeApprove(
            address(pool[OptionType.Call]),
            uint256(-1)
        );
        token[OptionType.Call].safeApprove(
            address(settlementFeeRecipient[OptionType.Call]),
            uint256(-1)
        );
        token[OptionType.Put].safeApprove(
            address(pool[OptionType.Put]),
            uint256(-1)
        );
        token[OptionType.Put].safeApprove(
            address(settlementFeeRecipient[OptionType.Put]),
            uint256(-1)
        );
    }

    /**
     * @notice Unlock funds locked in the expired options
     * @param optionID ID of the option
     */
    function unlock(uint256 optionID) external {
        Option storage option = options[optionID];
        require(
            option.expiration < block.timestamp,
            "Option has not expired yet"
        );
        require(option.state == State.Active, "Option is not active");
        option.state = State.Expired;
        pool[option.optionType].unlock(option.lockedLiquidityID);
        emit Expire(optionID);
    }

    /**
     * @notice Sends profits in current token from the liquidityPool to an option holder's address
     * @param optionID A specific option contract id
     */
    function payProfit(uint256 optionID) internal returns (uint256 profit) {
        Option memory option = options[optionID];

        address holder = ownerOf(optionID);
        uint256 currentPrice = _currentPrice();

        if (option.optionType == OptionType.Call) {
            require(option.strike <= currentPrice, "Current price is too low");
            profit = currentPrice.sub(option.strike).mul(option.amount).div(
                currentPrice
            );
        } else if (option.optionType == OptionType.Put) {
            require(option.strike >= currentPrice, "Current price is too high");
            profit = option.strike.sub(currentPrice).mul(option.amount).div(
                PRICE_DECIMALS
            );
        }

        pool[option.optionType].send(optionID, holder, profit);
    }

    function _currentPrice() internal view returns (uint256 price) {
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        price = uint256(latestPrice);
    }
}
