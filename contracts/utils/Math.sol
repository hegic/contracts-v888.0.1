pragma solidity 0.8.3;

/**
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

library HegicMath {
    /**
     * @dev Counts square root of the number.
     * Throws "invalid opcode" at uint(-1)
     */
    function sqrt(uint256 x) internal pure returns (uint256 result) {
        result = x;
        uint256 k = (x + 1) >> 1;
        while (k < result) (result, k) = (k, (x / k + k) >> 1);
    }

    /**
     * @dev Returns the integer division of two unsigned integers, reverting on
     * division by zero.
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function divCeil(uint256 a, uint256 b) internal pure returns (uint256) {
        return a % b == 0 ? a / b : (a / b) + 1;
    }
}
