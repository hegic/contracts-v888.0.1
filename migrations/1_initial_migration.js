const BN = web3.utils.BN
const Staking = artifacts.require("HegicStaking")
const WETH = artifacts.require("FakeWETH")
const WBTC = artifacts.require("FakeWBTC")
const USDC = artifacts.require("FakeUSDC")
const HEGIC = artifacts.require("FakeHEGIC")
const WETHStaking = artifacts.require("WETHStaking")
const USDCStaking = artifacts.require("USDCStaking")
const PriceCalculator = artifacts.require("PriceCalculator")
const ETHPriceProvider = artifacts.require("FakeETHPriceProvider")
const WETHPool = artifacts.require("WETHPool")
const USDCPool = artifacts.require("USDCPool")
const Options = artifacts.require("HegicOptions")

// const CONTRACTS_FILE = process.env.CONTRACTS_FILE

const params = {
  ETHPrice: new BN(1488e8),
  BTCPrice: new BN("4730000000000"),
  ETHPoolRates: [10000, 20000, 40000],
  // ETHtoBTC(){return this.ETHPrice.mul(new BN("10000000000000000000000000000000")).div(this.BTCPrice)},
  // ExchangePrice: new BN(30e8),
  // BC:{
  //     k: new BN("100830342800"),
  //     startPrice: new BN("350000000000000")
  // }
}

module.exports = async function (deployer, network, [account]) {
  if (["development", "develop", "soliditycoverage"].indexOf(network) >= 0) {
    await deployer.deploy(ETHPriceProvider, params.ETHPrice)

    await deployer.deploy(USDC)
    await deployer.deploy(WETH)
    await deployer.deploy(HEGIC)
    await deployer.deploy(WETHPool, WETH.address)
    await deployer.deploy(USDCPool, USDC.address)
    await deployer.deploy(WETHStaking, HEGIC.address, WETH.address)
    await deployer.deploy(USDCStaking, HEGIC.address, USDC.address)
    await deployer.deploy(
      PriceCalculator,
      params.ETHPoolRates,
      ETHPriceProvider.address,
      WETHPool.address,
      6
    )
    await deployer.deploy(
      Options,
      ETHPriceProvider.address,
      WETHPool.address,
      USDCPool.address,
      WETHStaking.address,
      USDCStaking.address,
      WETH.address,
      USDC.address,
      "Hegic Options (WETH)",
      "HO_WETH"
    )

    await WETHPool.deployed().then((pool) =>
      pool.transferOwnership(Options.address)
    )
    await USDCPool.deployed().then((pool) =>
      pool.transferOwnership(Options.address)
    )

    await USDC.deployed().then((usdc) => usdc.mintTo(account, "1000000000000"))
  } else {
    throw Error(`wrong network ${network}`)
  }
}
