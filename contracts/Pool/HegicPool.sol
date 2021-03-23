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

/**
 * @author 0mllwntrmt3
 * @title Hegic WBTC Liquidity Pool
 * @notice Accumulates liquidity in WBTC from LPs and distributes P&L in WBTC
 */
contract HegicPool is IHegicLiquidityPool, Ownable, ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant INITIAL_RATE = 1e20;
    uint256 public lockupPeriod = 2 weeks;
    uint256 public hedgeFeeRate = 80;

    uint256 public override lockedAmount;

    uint256 public unhedgedShare = 0;
    uint256 public hedgedShare = 0;
    uint256 public unhedgedBalance = 0;
    uint256 public hedgedBalance = 0;

    address public hedgePool;

    Tranche[] public tranches;
    LockedLiquidity[] public override lockedLiquidity;
    IERC20 public override token;

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
    function setLockupPeriod(uint256 value) external override onlyOwner {
        require(value <= 60 days, "Lockup period is too long");
        lockupPeriod = value;
    }

    /**
     * @notice Used for changing the hedge pool address
     * @param value New address
     */
    function setHedgePool(address value) external override onlyOwner {
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
        onlyOwner
        returns (uint256 id)
    {
        uint256 balance = totalBalance();
        require(
            lockedAmount.add(amount).mul(10) <= balance.mul(8),
            "Pool Error: Amount is too large."
        );
        uint256 hedgePremium = premium.mul(hedgedBalance).div(balance);
        uint256 hedgeFee = hedgePremium.mul(hedgeFeeRate).div(100);

        lockedAmount = lockedAmount.add(amount);
        id = lockedLiquidity.length;
        lockedLiquidity.push(
            LockedLiquidity(
                amount,
                hedgePremium.sub(hedgeFee),
                premium.sub(hedgePremium),
                true
            )
        );

        token.safeTransferFrom(msg.sender, address(this), premium);
        if (hedgeFee > 0) token.safeTransfer(hedgePool, hedgeFee);
    }

    /*
     * @nonce Called by the HegicOptions contract for unlocking liquidity in expired options
     * @param amount Amount of funds that should be unlocked in an expired option
     */
    function unlock(uint256 id) external override onlyOwner {
        LockedLiquidity storage ll = lockedLiquidity[id];
        _unlock(ll);
        emit Profit(id, ll.hedgePremium, ll.unhedgePremium);
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
    ) external override onlyOwner {
        require(to != address(0));
        LockedLiquidity storage ll = lockedLiquidity[id];
        _unlock(ll);

        uint256 transferAmount = amount > ll.amount ? ll.amount : amount;
        token.safeTransfer(to, transferAmount);
        uint256 hedgeLoss =
            transferAmount.mul(hedgedBalance).div(totalBalance());
        uint256 unhedgeLoss = transferAmount.sub(hedgeLoss);
        if (transferAmount <= ll.hedgePremium.add(ll.unhedgePremium))
            emit Profit(
                id,
                ll.hedgePremium - hedgeLoss,
                ll.unhedgePremium - unhedgeLoss
            );
        else
            emit Loss(
                id,
                hedgeLoss - ll.hedgePremium,
                unhedgeLoss - ll.unhedgePremium
            );
    }

    function _unlock(LockedLiquidity storage ll) private {
        require(
            ll.locked,
            "LockedLiquidity with such id has already been unlocked"
        );
        ll.locked = false;
        lockedAmount = lockedAmount.sub(ll.amount);
        hedgedBalance = hedgedBalance.add(ll.hedgePremium);
        unhedgedBalance = unhedgedBalance.add(ll.unhedgePremium);
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
            ? amount.mul(totalShare).div(balance)
            : amount.mul(INITIAL_RATE);

        require(share >= minShare, "Pool: Mint limit is too large");
        require(share > 0, "Pool: Amount is too small");

        if (hedging) {
            hedgedShare = hedgedShare.add(share);
            hedgedBalance = hedgedBalance.add(amount);
        } else {
            unhedgedShare = unhedgedShare.add(share);
            unhedgedBalance = unhedgedBalance.add(amount);
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
            block.timestamp > t.creationTimestamp.add(lockupPeriod),
            "Pool: Withdrawal is locked up"
        );

        t.state = TrancheState.Closed;
        if (t.hedged) {
            amount = t.share.mul(hedgedBalance).div(hedgedShare);
            hedgedShare = hedgedShare.sub(t.share);
            hedgedBalance = hedgedBalance.sub(amount);
        } else {
            amount = t.share.mul(unhedgedBalance).div(unhedgedShare);
            unhedgedShare = unhedgedShare.sub(t.share);
            unhedgedBalance = unhedgedBalance.sub(amount);
        }

        token.safeTransfer(ownerOf(trancheID), amount);
        emit Withdraw(msg.sender, trancheID);
    }

    /*
     * @nonce Returns the amount of WBTC available for withdrawals
     * @return balance Unlocked amount
     */
    function availableBalance() public view returns (uint256 balance) {
        return totalBalance().sub(lockedAmount);
    }

    /*
     * @nonce Returns the WBTC total balance provided to the pool
     * @return balance Pool balance
     */
    function totalBalance() public view override returns (uint256 balance) {
        return hedgedBalance.add(unhedgedBalance);
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
