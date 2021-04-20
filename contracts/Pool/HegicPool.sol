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
import "./HegicPoolAccess.sol";

/**
 * @author 0mllwntrmt3
 * @title Hegic WBTC Liquidity Pool
 * @notice Accumulates liquidity in WBTC from LPs and distributes P&L in WBTC
 */
contract HegicPool is IHegicLiquidityPool, ERC721, HegicPoolAccess {
    using SafeERC20 for IERC20;

    uint256 public constant INITIAL_RATE = 1e20;
    uint256 public lockupPeriod = 2 weeks;
    uint256 public constant HEDGE_FEE_RATE = 80;

    uint256 public override lockedAmount;

    uint256 public unhedgedShare = 0;
    uint256 public hedgedShare = 0;
    uint256 public unhedgedBalance = 0;
    uint256 public hedgedBalance = 0;

    address public hedgePool;

    Tranche[] public override tranches;
    LockedLiquidity[] public override lockedLiquidity;
    IERC20 public override immutable token;

    /*
     * @return _token WBTC Address
     */
    constructor(
        IERC20 _token,
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        token = _token;
        hedgePool = msg.sender;
    }

    /**
     * @notice Used for changing the lockup period
     * @param value New period value
     */
    function setLockupPeriod(uint256 value) external override onlyAdmin {
        require(value <= 60 days, "Lockup period is too long");
        lockupPeriod = value;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IHegicLiquidityPool).interfaceId ||
            AccessControl.supportsInterface(interfaceId) ||
            ERC721.supportsInterface(interfaceId);
    }

    /**
     * @notice Used for changing the hedge pool address
     * @param value New address
     */
    function setHedgePool(address value) external override onlyAdmin {
        require(value != address(0));
        hedgePool = value;
    }

    /*
     * @nonce Called by the HegicOptions contract for locking liquidity in options
     * @param amount Amount of funds that should be locked in an option
     */
    function lock(uint256 amount, uint256 premium)
        external
        override
        onlyHegicOptions
        returns (uint256 id)
    {
        uint256 balance = totalBalance();
        require(
            (lockedAmount + amount) * 10 <= balance * 8,
            "Pool Error: Amount is too large."
        );
        uint256 hedgePremium = (premium * hedgedBalance) / balance;
        uint256 hedgeFee = (hedgePremium * HEDGE_FEE_RATE) / 100;

        lockedAmount += amount;
        id = lockedLiquidity.length;
        lockedLiquidity.push(
            LockedLiquidity(
                uint88(amount),
                uint80(hedgePremium - hedgeFee),
                uint80(premium - hedgePremium),
                true
            )
        );

        token.safeTransferFrom(msg.sender, address(this), premium);
        // TODO: (gas optimisation) use withdrawal pattern
        if (hedgeFee > 0) token.safeTransfer(hedgePool, hedgeFee);
    }

    /*
     * @nonce Called by the HegicOptions contract for unlocking liquidity in expired options
     * @param amount Amount of funds that should be unlocked in an expired option
     */
    function unlock(uint256 id) external override onlyHegicOptions {
        LockedLiquidity storage ll = lockedLiquidity[id];
        _unlock(ll);
        emit Profit(uint256(id), uint256(ll.hedgePremium), uint256(ll.unhedgePremium));
    }

    /*
     * @nonce Called by the HegicCallOptions contracts for sending P&L to liquidity providers after an option's expiration
     * @param to Provider
     * @param amount Funds that should be sent
     */
    function send(
        uint256 id,
        address to,
        uint256 amount
    ) external override onlyHegicOptions {
        require(to != address(0));
        LockedLiquidity storage ll = lockedLiquidity[id];
        _unlock(ll);

        uint256 transferAmount = amount > uint256(ll.amount) ? uint256(ll.amount) : amount;
        token.safeTransfer(to, transferAmount);
        uint256 hedgeLoss = (transferAmount * hedgedBalance) / totalBalance();
        uint256 unhedgeLoss = transferAmount - hedgeLoss;
        if (transferAmount <= uint256(ll.hedgePremium + ll.unhedgePremium))
            emit Profit(
                id,
                uint256(ll.hedgePremium) - hedgeLoss,
                uint256(ll.unhedgePremium) - unhedgeLoss
            );
        else
            emit Loss(
                id,
                hedgeLoss - uint256(ll.hedgePremium),
                unhedgeLoss - uint256(ll.unhedgePremium)
            );
    }

    function _unlock(LockedLiquidity storage ll) private {
        require(
            ll.locked,
            "LockedLiquidity with such id has already been unlocked"
        );
        ll.locked = false;
        lockedAmount -= uint256(ll.amount);
        hedgedBalance += uint256(ll.hedgePremium);
        unhedgedBalance += uint256(ll.unhedgePremium);
    }

    /*
     * @nonce A provider supplies funds to the pool and receives write token
     * @param amount Provided tokens
     * @param minShare Minimum amount of "write" tokens that should be received by liquidity provider
                      Calling the provide function will require the minimum amount of tokens to be minted
                      The actual amount that will be minted could vary but can only be higher (not lower) than the minimum value
     * @return mint Amount of tokens to be received
     */
    function provideFrom(
        address account,
        uint256 amount,
        bool hedging,
        uint256 minShare
    ) external override returns (uint256 share) {
        uint256 totalShare = hedging ? hedgedShare : unhedgedShare;
        uint256 balance = hedging ? hedgedBalance : unhedgedBalance;
        share = totalShare > 0 && balance > 0
            ? (amount * totalShare) / balance
            : amount * INITIAL_RATE;

        require(share >= minShare, "Pool: Mint limit is too large");
        require(share > 0, "Pool: Amount is too small");

        if (hedging) {
            hedgedShare += share;
            hedgedBalance += amount;
        } else {
            unhedgedShare += share;
            unhedgedBalance += amount;
        }

        uint256 trancheID = tranches.length;
        tranches.push(
            Tranche(TrancheState.Open, share, amount, block.timestamp, hedging)
        );
        _safeMint(account, trancheID);
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Provide(account, amount, share, hedging);
    }

    function withdraw(uint256 trancheID)
        external
        override
        returns (uint256 amount)
    {
        Tranche memory t = tranches[trancheID];
        amount = _withdraw(trancheID);
        if (t.hedged && amount < t.amount) {
            token.safeTransferFrom(
                hedgePool,
                ownerOf(trancheID),
                t.amount - amount
            );
            amount = t.amount;
        }
    }

    function withdrawWithoutHedge(uint256 trancheID)
        external
        override
        returns (uint256 amount)
    {
        amount = _withdraw(trancheID);
    }

    /*
     * @nonce Liquidity provider burns writeWBTC and receives WBTC from the pool
     * @return amount Amount of tokens to be withdrawn
     */
    function _withdraw(uint256 trancheID) internal returns (uint256 amount) {
        Tranche storage t = tranches[trancheID];
        require(t.state == TrancheState.Open);
        require(_isApprovedOrOwner(msg.sender, trancheID));
        require(
            block.timestamp > t.creationTimestamp + lockupPeriod,
            "Pool: Withdrawal is locked up"
        );

        t.state = TrancheState.Closed;
        if (t.hedged) {
            amount = (t.share * hedgedBalance) / hedgedShare;
            hedgedShare -= t.share;
            hedgedBalance -= amount;
        } else {
            amount = (t.share * unhedgedBalance) / unhedgedShare;
            unhedgedShare -= t.share;
            unhedgedBalance -= amount;
        }

        token.safeTransfer(ownerOf(trancheID), amount);
        emit Withdraw(msg.sender, trancheID);
    }

    /*
     * @nonce Returns the amount of WBTC available for withdrawals
     * @return balance Unlocked amount
     */
    function availableBalance() public view returns (uint256 balance) {
        return totalBalance() - lockedAmount;
    }

    /*
     * @nonce Returns the WBTC total balance provided to the pool
     * @return balance Pool balance
     */
    function totalBalance() public view override returns (uint256 balance) {
        return hedgedBalance + unhedgedBalance;
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256 id
    ) internal view override {
        require(
            tranches[id].state == TrancheState.Open,
            "Pool: Closed tranches can not be transferred"
        );
    }
}
