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

import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract HegicPoolAccess is AccessControl {
    /**
     * @dev Will be revoked after BETA period is closed
     */
    bytes32 public constant BETA_ADMIN_ROLE = keccak256("BETA_ADMIN_ROLE");
    bytes32 public constant HEGIC_OPTIONS_ROLE =
        keccak256("HEGIC_OPTIONS_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(BETA_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(HEGIC_OPTIONS_ROLE, BETA_ADMIN_ROLE);
        _setRoleAdmin(BETA_ADMIN_ROLE, BETA_ADMIN_ROLE);
    }

    modifier onlyHegicOptions {
        require(
            hasRole(HEGIC_OPTIONS_ROLE, msg.sender),
            "The caller must have the HEGIC_OPTIONS_ROLE role"
        );
        _;
    }

    modifier onlyBetaAdmin {
        require(
            hasRole(BETA_ADMIN_ROLE, msg.sender),
            "The caller must have the BETA_ADMIN_ROLE role"
        );
        _;
    }

    modifier onlyAdmin {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "The caller must have the ADMIN role"
        );
        _;
    }
}
