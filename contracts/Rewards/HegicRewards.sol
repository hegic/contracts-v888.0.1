pragma solidity 0.7.6;

/**
 *  _____________________________________________
 * / oooooo   oooooo     oooo ooooo ooooooooo.   \
 * |  `888.    `888.     .8'  `888' `888   `Y88. |
 * |   `888.   .8888.   .8'    888   888   .d88' |
 * |    `888  .8'`888. .8'     888   888ooo88P'  |
 * |     `888.8'  `888.8'      888   888         |
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
 * Copyright (C) 2020 Hegic Protocol
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

abstract contract HegicRewards is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IHegicOptions public immutable hegicOptions;
    IERC20 public immutable hegic;
    mapping(uint256 => bool) public rewardedOptions;
    mapping(uint256 => uint256) public dailyReward;
    uint256 internal constant MAX_DAILY_REWARD = 165_000e18;
    uint256 internal constant REWARD_RATE_ACCURACY = 1e8;
    uint256 internal immutable MAX_REWARDS_RATE;
    uint256 internal immutable MIN_REWARDS_RATE;
    uint256 internal immutable FIRST_OPTION_ID;
    uint256 public rewardsRate;

    constructor(
        IHegicOptions _hegicOptions,
        IERC20 _hegic,
        uint256 maxRewardsRate,
        uint256 minRewardsRate,
        uint256 firstOptionID
    ) {
        hegicOptions = _hegicOptions;
        hegic = _hegic;
        MAX_REWARDS_RATE = maxRewardsRate;
        MIN_REWARDS_RATE = minRewardsRate;
        rewardsRate = maxRewardsRate;
        FIRST_OPTION_ID = firstOptionID;
    }

    // function getReward(uint optionId) external {
    //     uint amount = rewardAmount(optionId);
    //     uint today = block.timestamp / 1 days;
    //     dailyReward[today] = dailyReward[today].add(amount);
    //
    //     (IHegicOptions.State state, , , , , , , ) = hegicOptions.options(optionId);
    //     address holder = hegicOptions.ownerOf(optionId);
    //     require(optionId >= FIRST_OPTION_ID, "Wrong Option ID");
    //     require(state != IHegicOptions.State.Inactive, "The option is inactive");
    //     require(!rewardedOptions[optionId], "The option was rewarded");
    //     require(
    //         dailyReward[today] < MAX_DAILY_REWARD,
    //         "Exceeds daily limits"
    //     );
    //     rewardedOptions[optionId] = true;
    //     hegic.safeTransfer(holder, amount);
    // }

    function setRewardsRate(uint256 value) external onlyOwner {
        require(MIN_REWARDS_RATE <= value && value <= MAX_REWARDS_RATE);
        rewardsRate = value;
    }

    // function rewardAmount(uint optionId) internal view returns (uint) {
    //
    //     (, , uint _amount, , uint _premium, , , ) = hegicOptions.options(optionId);
    //     return _amount.div(100).add(_premium)
    //         .mul(rewardsRate)
    //         .div(REWARD_RATE_ACCURACY);
    // }
}
