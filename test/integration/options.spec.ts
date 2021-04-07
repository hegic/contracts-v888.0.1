import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {HegicOptions} from "../../typechain/HegicOptions"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {HegicStaking} from "../../typechain/HegicStaking"
import {Erc20Mock} from "../../typechain/Erc20Mock"

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
  let fakeHegic: Erc20Mock
  let fakeUSDC: Erc20Mock
  let fakeWBTC: Erc20Mock
  let deployer: Signer
  let alice: Signer

  beforeEach(async () => {
    await deployments.fixture()
    ;[deployer, alice] = await ethers.getSigners()

    hegicPoolWBTC = (await ethers.getContract("HegicWBTCPool")) as HegicPool
    hegicPoolUSDC = (await ethers.getContract("HegicUSDCPool")) as HegicPool
    hegicStakingWBTC = (await ethers.getContract("WBTCStaking")) as HegicStaking
    hegicStakingUSDC = (await ethers.getContract("USDCStaking")) as HegicStaking
    priceCalculator = (await ethers.getContract(
      "WBTCPriceCalculator",
    )) as PriceCalculator
    hegicOptions = (await ethers.getContract("WBTCOptions")) as HegicOptions
    fakeHegic = (await ethers.getContract("HEGIC")) as Erc20Mock
    fakeUSDC = (await ethers.getContract("USDC")) as Erc20Mock
    fakeWBTC = (await ethers.getContract("WBTC")) as Erc20Mock

    await fakeHegic.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
    )

    await fakeUSDC.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("1000000", await fakeUSDC.decimals()),
    )

    await fakeWBTC.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
    )

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
  interface Fees {
    settlementFee: BN
    premium: BN
  }
  let amount: BN
  let strike: BN
  let fees: Fees
  let deployerWBTCBalanceBefore: BN
  let deployerUSDCBalanceBefore: BN
  let aliceWBTCBalanceBefore: BN
  let aliceUSDCBalanceBefore: BN
  let hegicPoolWBTCBalanceBefore: BN
  let lockedAmountBefore: BN
  let hedgePremium: BN
  let hedgeFee: BN
  let amountToLock: BN
  let hegicStakingUSDCBalanceBefore: BN

  describe("Buying a call option with lots in the staking pool", async () => {
    beforeEach(async () => {
      amount = await ethers.utils.parseUnits("15", await fakeWBTC.decimals())
      strike = BN.from(50000)
      aliceWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await alice.getAddress(),
      )
      hegicPoolWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await hegicPoolWBTC.address,
      )
      deployerWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await deployer.getAddress(),
      )
      lockedAmountBefore = await hegicPoolWBTC.lockedAmount()
      fees = await priceCalculator.fees(ONE_DAY, amount, strike, 2)

      await fakeHegic
        .connect(alice)
        .approve(
          await hegicStakingWBTC.address,
          await ethers.constants.MaxUint256,
        )
      await hegicStakingWBTC.connect(alice).buy(1)

      await hegicOptions
        .connect(alice)
        .createFor(
          await alice.getAddress(),
          ONE_DAY,
          amount,
          strike,
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
      expect(option.strike).to.eq(strike)
      expect(option.optionType).to.eq(BN.from(2))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })
    it("should decrease Alice's balance by the settlement fee and premium", async () => {
      expect(
        aliceWBTCBalanceBefore.sub(fees.settlementFee).sub(fees.premium),
      ).to.eq(await fakeWBTC.balanceOf(await alice.getAddress()))
    })
    it("should add the premium and subtract the hedge fee from the HegicPool", async () => {
      expect(hegicPoolWBTCBalanceBefore.add(fees.premium).sub(hedgeFee)).to.eq(
        await fakeWBTC.balanceOf(await hegicPoolWBTC.address),
      )
    })
    it("should increase the balance of HegicStaking by the settlement fee", async () => {
      expect(await fakeWBTC.balanceOf(await hegicStakingWBTC.address)).to.eq(
        fees.settlementFee,
      )
    })
    it("should increase the lockedAmount in the Liquidity Pool", async () => {
      expect(lockedAmountBefore.add(amount)).to.eq(
        await hegicPoolWBTC.lockedAmount(),
      )
    })
    it("should add the locked liquidity to LockedLiquidity[] in the LP", async () => {
      const ll = await hegicPoolWBTC.lockedLiquidity(BN.from(0))
      expect(ll.amount).to.equal(amount)
      expect(ll.hedgePremium).to.equal(hedgePremium.sub(hedgeFee))
      expect(ll.unhedgePremium).to.equal(BN.from(0))
      expect(ll.locked).to.equal(true)
    })
  })
  describe("Buying a call option with no lots in the staking pool", async () => {
    beforeEach(async () => {
      amount = await ethers.utils.parseUnits("15", await fakeWBTC.decimals())
      strike = BN.from(50000)
      fees = await priceCalculator.fees(ONE_DAY, amount, strike, 2)
      await hegicOptions
        .connect(alice)
        .createFor(
          await alice.getAddress(),
          ONE_DAY,
          amount,
          strike,
          BN.from(2),
        )
    })
    it("should send the hedge fee and settlement fee to the deployer address", async () => {
      expect(
        deployerWBTCBalanceBefore.add(hedgeFee).add(fees.settlementFee),
      ).to.eq(await fakeWBTC.balanceOf(await deployer.getAddress()))
    })
  })
  describe("Buying a put option with lots in the staking pool", async () => {
    beforeEach(async () => {
      await fakeHegic
        .connect(alice)
        .approve(
          await hegicStakingUSDC.address,
          await ethers.constants.MaxUint256,
        )
      await hegicStakingUSDC.connect(alice).buy(1)
      amount = await ethers.utils.parseUnits("15", await fakeWBTC.decimals())
      strike = BN.from(50000)
      aliceUSDCBalanceBefore = await fakeUSDC.balanceOf(
        await alice.getAddress(),
      )
      hegicStakingUSDCBalanceBefore = await fakeUSDC.balanceOf(
        await hegicStakingUSDC.address,
      )
      lockedAmountBefore = await hegicPoolUSDC.lockedAmount()
      fees = await priceCalculator.fees(ONE_DAY, amount, strike, 1)
      await hegicOptions
        .connect(alice)
        .createFor(
          await alice.getAddress(),
          ONE_DAY,
          amount,
          strike,
          BN.from(1),
        )

      amountToLock = amount
        .mul(strike)
        .mul(BN.from(10).pow(6)) // BASE_TOKEN_DECIMALS
        .div(BN.from(10).pow(4)) // STABLE_TOKEN_DECIMALS
        .div(BN.from(10).pow(8)) // PRICE_DECIMALS
    })
    it("should create the put option", async () => {
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(strike)
      expect(option.optionType).to.eq(BN.from(1))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })
    it("should decrease Alice's balance by the settlement fee and premium", async () => {
      expect(
        aliceUSDCBalanceBefore.sub(fees.settlementFee).sub(fees.premium),
      ).to.eq(await fakeUSDC.balanceOf(await alice.getAddress()))
    })
    it("should increase the balance of the USDC Staking Contract by the settlement fee", async () => {
      expect(hegicStakingUSDCBalanceBefore.add(fees.settlementFee)).to.eq(
        await fakeUSDC.balanceOf(await hegicStakingUSDC.address),
      )
    })
    it("should increase the lockedAmount in the Liquidity Pool", async () => {
      expect(lockedAmountBefore.add(amountToLock)).to.eq(
        await hegicPoolUSDC.lockedAmount(),
      )
    })
    it("should add the locked liquidity to LockedLiquidity[] in the LP", async () => {
      const ll = await hegicPoolUSDC.lockedLiquidity(BN.from(0))
      expect(ll.amount).to.equal(amountToLock)
      // TODO - verify the premium
      // expect(ll.hedgePremium).to.equal(BN.from(0))
      // expect(ll.unhedgePremium).to.equal(BN.from(0))
      expect(ll.locked).to.equal(true)
    })
  })
  describe("Buying a put option with no lots in the staking pool", async () => {
    beforeEach(async () => {
      deployerUSDCBalanceBefore = await fakeUSDC.balanceOf(
        await deployer.getAddress(),
      )
      amount = await ethers.utils.parseUnits("15", await fakeWBTC.decimals())
      strike = BN.from(50000)
      fees = await priceCalculator.fees(ONE_DAY, amount, strike, 1)
      await hegicOptions
        .connect(alice)
        .createFor(
          await alice.getAddress(),
          ONE_DAY,
          amount,
          strike,
          BN.from(1),
        )
    })
    it("should send the hedge fee and settlement fee to the deployer address", async () => {
      // TODO verify there is no fee
      expect(deployerUSDCBalanceBefore.add(fees.settlementFee)).to.eq(
        await fakeUSDC.balanceOf(await deployer.getAddress()),
      )
    })
  })
  xdescribe("Exercising a call option", async () => {})
  xdescribe("Exercising a put option", async () => {})
  xdescribe("Expiring a call option", async () => {})
  xdescribe("Expiring a put option", async () => {})
})
