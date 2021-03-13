import {ethers} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {HegicOptions} from "../../typechain/HegicOptions"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {HegicStaking} from "../../typechain/HegicStaking"
import {FakeHegic} from "../../typechain/FakeHegic"
import {FakeUsdc} from "../../typechain/FakeUsdc"
import {FakeWbtc} from "../../typechain/FakeWbtc"
import {FakePriceProvider} from "../../typechain/FakePriceProvider"

chai.use(solidity)
const {expect} = chai
const ONE_DAY = BN.from(86400)

describe("Options", async () => {
  let hegicPoolWBTC: HegicPool
  let hegicPoolUSDC: HegicPool
  let hegicStakingWBTC: HegicStaking
  let hegicStakingUSDC: HegicStaking
  let hegicOptions: HegicOptions
  let priceCalculator: PriceCalculator
  let fakeHegic: FakeHegic
  let fakeUSDC: FakeUsdc
  let fakeWBTC: FakeWbtc
  let fakePriceProvider: FakePriceProvider
  let deployer: Signer
  let alice: Signer

  beforeEach(async () => {
    ;[deployer, alice] = await ethers.getSigners()

    const fakeHegicFactory = await ethers.getContractFactory("FakeHEGIC")
    fakeHegic = (await fakeHegicFactory.connect(deployer).deploy()) as FakeHegic
    await fakeHegic.deployed()
    await fakeHegic.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
    )

    const fakeUsdcFactory = await ethers.getContractFactory("FakeUSDC")
    fakeUSDC = (await fakeUsdcFactory.connect(deployer).deploy()) as FakeUsdc
    await fakeUSDC.deployed()
    await fakeUSDC.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("1000000", await fakeUSDC.decimals()),
    )

    const fakeWbtcFactory = await ethers.getContractFactory("FakeWBTC")
    fakeWBTC = (await fakeWbtcFactory.connect(deployer).deploy()) as FakeWbtc
    await fakeWBTC.deployed()
    await fakeWBTC.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
    )

    const fakePriceProviderFactory = await ethers.getContractFactory(
      "FakePriceProvider",
    )
    fakePriceProvider = (await fakePriceProviderFactory
      .connect(deployer)
      .deploy(BN.from(50000))) as FakePriceProvider
    await fakePriceProvider.deployed()

    const hegicPoolWBTCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolWBTC = (await hegicPoolWBTCFactory.deploy(
      await fakeWBTC.address,
      "writeWBTC",
      "wWBTC",
    )) as HegicPool
    await hegicPoolWBTC.deployed()

    const hegicPoolUSDCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolUSDC = (await hegicPoolUSDCFactory
      .connect(deployer)
      .deploy(await fakeUSDC.address, "writeUSDC", "wUSDC")) as HegicPool
    await hegicPoolUSDC.deployed()

    const hegicStakingWBTCFactory = await ethers.getContractFactory(
      "HegicStaking",
    )
    hegicStakingWBTC = (await hegicStakingWBTCFactory
      .connect(deployer)
      .deploy(
        await fakeHegic.address,
        await fakeWBTC.address,
        "Hegic WBTC Lot",
        "hlWBTC",
      )) as HegicStaking
    await hegicStakingWBTC.deployed()

    const hegicStakingUSDCFactory = await ethers.getContractFactory(
      "HegicStaking",
    )
    hegicStakingUSDC = (await hegicStakingUSDCFactory
      .connect(deployer)
      .deploy(
        await fakeHegic.address,
        await fakeUSDC.address,
        "Hegic USDC Lot",
        "hlUSDC",
      )) as HegicStaking
    await hegicStakingUSDC.deployed()

    const priceCalculatorFactory = await ethers.getContractFactory(
      "PriceCalculator",
    )
    priceCalculator = (await priceCalculatorFactory
      .connect(deployer)
      .deploy(
        [9000, 10000, 20000],
        await fakePriceProvider.address,
        await hegicPoolWBTC.address,
        6,
      )) as PriceCalculator
    await priceCalculator.deployed()

    const hegicOptionsFactory = await ethers.getContractFactory("HegicOptions")
    hegicOptions = (await hegicOptionsFactory
      .connect(deployer)
      .deploy(
        await fakePriceProvider.address,
        await hegicPoolWBTC.address,
        await hegicPoolUSDC.address,
        await hegicStakingUSDC.address,
        await hegicStakingWBTC.address,
        await fakeWBTC.address,
        await fakeUSDC.address,
        "HegicOptions WBTC",
        "HO_WBTC",
      )) as HegicOptions
    await hegicOptions.deployed()

    await hegicOptions.updatePriceCalculator(await priceCalculator.address)

    await hegicPoolWBTC.transferOwnership(await hegicOptions.address)
    await hegicPoolUSDC.transferOwnership(await hegicOptions.address)

    await fakeWBTC
      .connect(alice)
      .approve(await hegicPoolWBTC.address, await ethers.constants.MaxUint256)

    await fakeWBTC
      .connect(alice)
      .approve(await hegicOptions.address, await ethers.constants.MaxUint256)

    await hegicPoolWBTC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        await ethers.utils.parseUnits("1000", await fakeWBTC.decimals()),
        true,
        await ethers.utils.parseUnits("1000", await fakeWBTC.decimals()),
      )

    await fakeUSDC
      .connect(alice)
      .approve(await hegicPoolUSDC.address, await ethers.constants.MaxUint256)

    await fakeUSDC
      .connect(alice)
      .approve(await hegicOptions.address, await ethers.constants.MaxUint256)

    await hegicPoolUSDC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        await ethers.utils.parseUnits("1000", await fakeUSDC.decimals()),
        true,
        await ethers.utils.parseUnits("1000", await fakeUSDC.decimals()),
      )
  })

  describe("Buying a call option with no lots in the staking pool", async () => {
    interface Fees {
      settlementFee: BN
      premium: BN
    }
    let amount: BN
    let fees: Fees
    let deployerWBTCBalanceBefore: BN
    let aliceBalanceBefore: BN
    let hegicPoolWBTCBalanceBefore: BN
    let lockedAmountBefore: BN
    let hedgePremium: BN
    let hedgeFee: BN
    beforeEach(async () => {
      amount = await ethers.utils.parseUnits("15", await fakeWBTC.decimals())
      aliceBalanceBefore = await fakeWBTC.balanceOf(await alice.getAddress())
      hegicPoolWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await hegicPoolWBTC.address,
      )
      deployerWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await deployer.getAddress(),
      )
      lockedAmountBefore = await hegicPoolWBTC.lockedAmount()
      fees = await priceCalculator.fees(ONE_DAY, amount, BN.from(50000), 2)
      await hegicOptions
        .connect(alice)
        .createFor(
          await alice.getAddress(),
          ONE_DAY,
          amount,
          BN.from(50000),
          BN.from(2),
        )
      const poolTotalBalance = await hegicPoolWBTC.totalBalance()
      const poolHedgedBalance = await hegicPoolWBTC.hedgedBalance()
      const poolHedgeFeeRate = await hegicPoolWBTC.hedgeFeeRate()

      hedgePremium = await fees.premium
        .mul(poolHedgedBalance)
        .div(poolTotalBalance)

      hedgeFee = await hedgePremium.mul(poolHedgeFeeRate).div(BN.from(100))
    })
    it("should create the call option", async () => {
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
    })
    it("should decrease Alice's balance by the settlement fee and premium", async () => {
      expect(
        aliceBalanceBefore.sub(fees.settlementFee).sub(fees.premium),
      ).to.eq(await fakeWBTC.balanceOf(await alice.getAddress()))
    })
    it("should add the premium and subtract the hedge fee from the HegicPool", async () => {
      expect(hegicPoolWBTCBalanceBefore.add(fees.premium).sub(hedgeFee)).to.eq(
        await fakeWBTC.balanceOf(await hegicPoolWBTC.address),
      )
    })
    it("should send the hedge fee and settlement fee to the deployer address", async () => {
      expect(
        deployerWBTCBalanceBefore.add(hedgeFee).add(fees.settlementFee),
      ).to.eq(await fakeWBTC.balanceOf(await deployer.getAddress()))
    })
    it("should increase the lockedAmount in the Liquidity Pool", async () => {
      expect(lockedAmountBefore.add(amount)).to.eq(
        await hegicPoolWBTC.lockedAmount(),
      )
    })
    it("should added the locked liquidity to LockedLiquidity[] in the LP", async () => {
      const ll = await hegicPoolWBTC.lockedLiquidity(BN.from(0))
      expect(ll.amount).to.equal(amount)
      expect(ll.hedgePremium).to.equal(hedgePremium.sub(hedgeFee))
      expect(ll.unhedgePremium).to.equal(BN.from(0))
      expect(ll.locked).to.equal(true)
    })
  })
  xdescribe("Buying a call option with lots in the staking pool", async () => {})
  xdescribe("Buying a put option with no lots in the staking pool", async () => {})
  xdescribe("Buying a put option with lots in the staking pool", async () => {})
  xdescribe("Exercising a call option", async () => {})
  xdescribe("Exercising a put option", async () => {})
  xdescribe("Expiring a call option", async () => {})
  xdescribe("Expiring a put option", async () => {})
})
