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

import "./HegicRewards.sol";

contract HegicWBTCRewards is HegicRewards {
    constructor(IHegicOptions _hegicOptions, IERC20 _hegic)
        HegicRewards(_hegicOptions, _hegic, 1_000_000e18, 10e8, 54)
    {}
}
