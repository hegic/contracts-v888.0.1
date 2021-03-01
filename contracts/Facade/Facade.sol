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

contract Facade is Ownable {
    mapping(IERC20 => bool) supported;
    mapping(IERC20 => IHegicOptions) optionController;
    mapping(IERC20 => IHegicLiquidityPool) poolController;

    IWETH weth;

    function createOption(
        IERC20 token,
        uint256 period,
        uint256 amount,
        uint256 strike,
        IHegicOptions.OptionType optionType
    ) external payable withSupported(token) {
        _wrapTo(token);
        IHegicOptions options = optionController[token];
        options.createFor(msg.sender, period, amount, strike, optionType);
    }

    modifier withSupported(IERC20 token) {
        require(supported[token], "Unsupported token");
        _;
    }

    function append(
        IERC20 token,
        IHegicOptions options,
        IHegicLiquidityPool pool
    ) external onlyOwner {
        supported[token] = true;
        optionController[token] = options;
        poolController[token] = pool;
    }

    function stop(IERC20 token) external onlyOwner withSupported(token) {
        delete supported[token];
        delete optionController[token];
        delete poolController[token];
    }

    function _wrapTo(IERC20 token) internal {
        if (address(token) == address(weth)) weth.deposit{value: msg.value}();
        else {
            revert("TODO");
        }
    }

    /**
     * @notice Unlocks an array of options
     * @param optionIDs array of options
     */
    function unlockAll(IERC20 token, uint256[] calldata optionIDs) external {
        revert("TODO");
        // uint arrayLength = optionIDs.length;
        // for (uint256 i = 0; i < arrayLength; i++) {
        //     unlock(optionIDs[i]);
        // }
    }
}
