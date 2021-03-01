pragma solidity 0.7.6;
/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Hegic
 * Copyright (C) 2020 Hegic
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
import "./Interfaces/Interfaces.sol";
import "./Rewards/Synthetix/StakingRewards.sol";
import "./Staking/HegicStaking.sol";
import "./Pool/HegicPool.sol";

contract FakeExchange {
    uint256 public exchangeRate;
    FakeWBTC public token;
    address public WETH = address(this);

    constructor(FakeWBTC t, uint256 _exchangeRate) {
        token = t;
        exchangeRate = _exchangeRate;
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256
    ) external payable returns (uint256[] memory amounts) {
        uint256 amountIn = getAmountsIn(amountOut, path)[0];
        require(msg.value >= amountIn, "Fake Uniswap: value is too small");
        amounts = new uint256[](1);
        amounts[0] = msg.value;

        token.mintTo(to, amountOut);
    }

    function getAmountsIn(uint256 amountOut, address[] memory)
        public
        view
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](1);
        amounts[0] = (amountOut * exchangeRate) / 1e18;
    }
}

contract FakePriceProvider is AggregatorV3Interface {
    uint256 public price;
    uint8 public override decimals = 8;
    string public override description = "Test implementatiln";
    uint256 public override version = 0;

    constructor(uint256 _price) {
        price = _price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getRoundData(uint80)
        external
        pure
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        revert("Test implementation");
    }

    function latestAnswer() external view returns (int256 result) {
        (, result, , , ) = latestRoundData();
    }

    function latestRoundData()
        public
        view
        override
        returns (
            uint80,
            int256 answer,
            uint256,
            uint256,
            uint80
        )
    {
        answer = int256(price);
        return (0, answer, 0, 0, 0);
    }
}

contract FakeBTCPriceProvider is FakePriceProvider {
    constructor(uint256 price) FakePriceProvider(price) {}
}

contract FakeETHPriceProvider is FakePriceProvider {
    constructor(uint256 price) FakePriceProvider(price) {}
}

contract FakeERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol) {
        _setupDecimals(decimals);
    }

    function mintTo(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}

contract FakeUSDC is FakeERC20("FakeUSDC", "FUSDC", 6) {}

contract FakeWBTC is FakeERC20("FakeWBTC", "FWBTC", 8) {}

contract FakeWETH is FakeERC20("FakeWETH", "FWETH", 18) {}

contract FakeHEGIC is FakeERC20("FakeHEGIC", "FAKEH", 18) {}

contract ETHStakingRewards is StakingRewards {
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    )
        StakingRewards(
            _owner,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken
        )
    {}
}

contract WETHStaking is HegicStaking {
    constructor(ERC20 _hegic, ERC20 _token)
        HegicStaking(_hegic, _token, "WETH Staking", "WETH S")
    {}
}

contract USDCStaking is HegicStaking {
    constructor(ERC20 _hegic, ERC20 _token)
        HegicStaking(_hegic, _token, "USDC Staking", "USDC S")
    {}
}

contract WBTCStakingRewards is StakingRewards {
    constructor(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    )
        StakingRewards(
            _owner,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken
        )
    {}
}

contract WETHPool is HegicPool {
    constructor(ERC20 token)
        HegicPool(token, "Test WETH Write Pool", "WriteWETH")
    {}
}

contract USDCPool is HegicPool {
    constructor(ERC20 token)
        HegicPool(token, "Test USDC Write Pool", "WriteUSDC")
    {}
}

//
// contract WETHOptions is HegicOptions {
//   constructor(ERC20 token) HegicPool(token, "Test WETH Write Pool", "WriteWETH") {}
// }
