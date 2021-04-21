pragma solidity 0.8.3;

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
    using SafeERC20 for IERC20;

    uint256 internal immutable BASE_TOKEN_DECIMALS; // / 1e18;
    uint256 internal immutable STABLE_TOKEN_DECIMALS; // / 1e6;
    uint256 internal constant PRICE_DECIMALS = 1e8;
    uint256 internal immutable CONTRACT_CREATED = block.timestamp;

    Option[] public override options;

    AggregatorV3Interface public immutable priceProvider;
    mapping(OptionType => IHegicLiquidityPool) public pool;
    IERC20 public immutable tokenCall;
    IERC20 public immutable tokenPut; 
    // mapping(OptionType => IERC20) public token;
    IPriceCalculator public override priceCalculator;

    /**
     * @param _priceProvider The address of ChainLink price feed contract
     * @param _token The address of main token contract (WETH or WBTC)
     */
    constructor(
        AggregatorV3Interface _priceProvider,
        IPriceCalculator _pricer,
        IHegicLiquidityPool _stablePool,
        IHegicLiquidityPool liquidityPool,
        IHegicStaking putSettlementFeeRecipient,
        IHegicStaking callSettlementFeeRecipient,
        ERC20 _stable,
        ERC20 _token,
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        setPools(_stablePool, liquidityPool);
        setSettlementFeeRecipients(
            putSettlementFeeRecipient,
            _stablePool,
            callSettlementFeeRecipient,
            liquidityPool
        );
        priceCalculator = _pricer;
        tokenCall = _token;
        tokenPut = _stable;
        priceProvider = _priceProvider;

        IERC20(_token).safeApprove(
            address(pool[OptionType.Call]),
            type(uint256).max
        );
        IERC20(_stable).safeApprove(
            address(pool[OptionType.Put]),
            type(uint256).max
        );

        uint256 baseDecimals = _token.decimals();
        uint256 stableDecimals = _stable.decimals();
        uint256 min =
            baseDecimals < stableDecimals ? baseDecimals : stableDecimals;
        baseDecimals -= min;
        stableDecimals -= min;
        BASE_TOKEN_DECIMALS = 10**baseDecimals;
        STABLE_TOKEN_DECIMALS = 10**stableDecimals;
    }

    /**
     * @notice Used for changing settlementFeeRecipient
     * @param putRecipient  New settlementFee recipient address
     * @param callRecipient New settlementFee recipient address
     */
    function setSettlementFeeRecipients(
        IHegicStaking putRecipient,
        IHegicLiquidityPool putPool,
        IHegicStaking callRecipient,
        IHegicLiquidityPool callPool
    ) public onlyOwner {
        require(address(putRecipient) != address(0));
        require(address(callRecipient) != address(0));
        putPool.setSettlementFeeRecipient(putRecipient);
        callPool.setSettlementFeeRecipient(callRecipient);
    }

    function setPriceCalculator(IPriceCalculator pc) public onlyOwner {
        priceCalculator = pc;
    }

    function setPools(IHegicLiquidityPool putPool, IHegicLiquidityPool callPool)
        public
        onlyOwner
    {
        pool[OptionType.Call] = callPool;
        pool[OptionType.Put] = putPool;
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

        tokenCall.safeTransferFrom(
            msg.sender,
            address(pool[OptionType.Call]),
            settlementFee + premium
        );

        uint256 lockedAmount = amount;
        optionID = options.length;
        uint256 lockedLiquidityID =
            pool[OptionType.Call].lock(lockedAmount, premium, settlementFee);

        options.push(
            Option(
                uint128(amount),
                uint32(strike),
                uint32(block.timestamp + period),
                uint32(lockedLiquidityID),
                State.Active,
                OptionType.Call
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
            (amount * strike * STABLE_TOKEN_DECIMALS) /
                BASE_TOKEN_DECIMALS /
                PRICE_DECIMALS;

        optionID = options.length;

        tokenPut.safeTransferFrom(
            msg.sender,
            address(pool[OptionType.Put]),
            settlementFee + premium
        );

        uint256 lockedLiquidityID =
            pool[OptionType.Put].lock(lockedAmount, premium, settlementFee);
        options.push(
            Option(
                uint128(amount),
                uint32(strike),
                uint32(block.timestamp + period),
                uint32(lockedLiquidityID),
                State.Active,
                OptionType.Put
            )
        );

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
        tokenCall.safeApprove(
            address(pool[OptionType.Call]),
            type(uint256).max
        );
        tokenPut.safeApprove(
            address(pool[OptionType.Put]),
            type(uint256).max
        );
    }

    /**
     * @notice Unlock funds locked in the expired options
     * @param optionID ID of the option
     */
    function unlock(uint256 optionID) external override {
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
            profit =
                ((currentPrice - option.strike) * option.amount) /
                currentPrice;
        } else if (option.optionType == OptionType.Put) {
            require(option.strike >= currentPrice, "Current price is too high");
            profit =
                ((option.strike - currentPrice) *
                    option.amount *
                    STABLE_TOKEN_DECIMALS) /
                PRICE_DECIMALS /
                BASE_TOKEN_DECIMALS;
        }

        pool[option.optionType].send(optionID, holder, profit);
    }

    function _currentPrice() internal view returns (uint256 price) {
        (, int256 latestPrice, , , ) = priceProvider.latestRoundData();
        price = uint256(latestPrice);
    }
}
