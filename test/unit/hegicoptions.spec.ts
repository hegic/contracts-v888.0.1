import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {HegicOptions} from "../../typechain/HegicOptions"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {HegicStaking} from "../../typechain/HegicStaking"
import {Erc20Mock} from "../../typechain/Erc20Mock"
import {PriceProviderMock} from "../../typechain/PriceProviderMock"

chai.use(solidity)
const {expect} = chai

describe("HegicOptions", async () => {
  let hegicPoolWBTC: HegicPool
  let hegicPoolUSDC: HegicPool
  let hegicStakingWBTC: HegicStaking
  let hegicStakingUSDC: HegicStaking
  let hegicOptions: HegicOptions
  let priceCalculator: PriceCalculator
  let fakeHegic: Erc20Mock
  let fakeUSDC: Erc20Mock
  let fakeWBTC: Erc20Mock
  let fakePriceProvider: PriceProviderMock
  let alice: Signer
  let bob: Signer

  beforeEach(async () => {
    await deployments.fixture()
    ;[, alice, bob] = await ethers.getSigners()

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
    fakePriceProvider = (await ethers.getContract(
      "WBTCPriceProvider",
    )) as PriceProviderMock

    await fakeHegic.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
    )

    await fakeUSDC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits("1000000000000", await fakeUSDC.decimals()),
    )

    await fakeWBTC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits("100000000", await fakeWBTC.decimals()),
    )

    await fakeWBTC
      .connect(alice)
      .approve(hegicPoolWBTC.address, ethers.constants.MaxUint256)
    await fakeWBTC
      .connect(alice)
      .approve(hegicOptions.address, ethers.constants.MaxUint256)

    await hegicPoolWBTC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
        true,
        ethers.utils.parseUnits("1000000", await fakeWBTC.decimals()),
      )

    await fakeUSDC
      .connect(alice)
      .approve(hegicPoolUSDC.address, ethers.constants.MaxUint256)

    await fakeUSDC
      .connect(alice)
      .approve(hegicOptions.address, ethers.constants.MaxUint256)

    await hegicPoolUSDC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        ethers.utils.parseUnits("1000000000", await fakeUSDC.decimals()),
        true,
        ethers.utils.parseUnits("1000000000", await fakeUSDC.decimals()),
      )
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await hegicOptions.priceCalculator()).to.be.eq(
        priceCalculator.address,
      )
      expect(await hegicOptions.pool(BN.from(1))).to.eq(hegicPoolUSDC.address)
      expect(await hegicOptions.pool(BN.from(2))).to.eq(hegicPoolWBTC.address)
      expect(await hegicOptions.settlementFeeRecipient(BN.from(1))).to.eq(
        hegicStakingUSDC.address,
      )
      expect(await hegicOptions.settlementFeeRecipient(BN.from(2))).to.eq(
        hegicStakingWBTC.address,
      )
      expect(await hegicOptions.token(BN.from(1))).to.eq(fakeUSDC.address)
      expect(await hegicOptions.token(BN.from(2))).to.eq(fakeWBTC.address)
      expect(await hegicOptions.priceProvider()).to.be.eq(
        fakePriceProvider.address,
      )
    })
  })

  describe("setPools", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .setPools(ethers.constants.AddressZero, ethers.constants.AddressZero),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should update pools", async () => {
      const newPoolAddresses = [await alice.getAddress(), hegicOptions.address]

      await hegicOptions.setPools(newPoolAddresses[0], newPoolAddresses[1])

      expect(await hegicOptions.pool(1)).to.be.eq(newPoolAddresses[0])
      expect(await hegicOptions.pool(2)).to.be.eq(newPoolAddresses[1])
    })
  })

  describe("setSettlementFeeRecipients", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .setSettlementFeeRecipients(
            await alice.getAddress(),
            await bob.getAddress(),
          ),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if zero address is given for recipientPut", async () => {
      await expect(
        hegicOptions.setSettlementFeeRecipients(
          ethers.constants.AddressZero,
          await bob.getAddress(),
        ),
      ).to.be.reverted
    })

    it("should revert if zero address is given for recipientCall", async () => {
      await expect(
        hegicOptions.setSettlementFeeRecipients(
          await alice.getAddress(),
          ethers.constants.AddressZero,
        ),
      ).to.be.reverted
    })

    it("should update the settlement fee recipients", async () => {
      await hegicOptions.setSettlementFeeRecipients(
        await alice.getAddress(),
        await bob.getAddress(),
      )

      expect(await hegicOptions.settlementFeeRecipient(BN.from(1))).to.eq(
        await alice.getAddress(),
      )

      expect(await hegicOptions.settlementFeeRecipient(BN.from(2))).to.eq(
        await bob.getAddress(),
      )
    })
  })

  describe("setPriceCalculator", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions.connect(alice).setPriceCalculator(priceCalculator.address),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should update the priceCalculator correctly", async () => {
      const priceCalculatorBefore = await hegicOptions.priceCalculator()
      expect(priceCalculatorBefore).to.be.eq(priceCalculator.address)
      await hegicOptions.setPriceCalculator(await alice.getAddress())
      const priceCalculatorAfter = await hegicOptions.priceCalculator()
      expect(priceCalculatorAfter).to.be.eq(await alice.getAddress())
    })
  })

  describe("createFor", async () => {
    // TODO test line 130
    it("should revert if the strike is less than 1 day", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .createFor(await alice.getAddress(), 1, 1, 1, 1),
      ).to.be.revertedWith("Period is too short")
    })
    it("should revert if the strike is greater than 12 weeks", async () => {
      // Test for 13 weeks
      await expect(
        hegicOptions
          .connect(alice)
          .createFor(await alice.getAddress(), 7862400, 1, 1, 1),
      ).to.be.revertedWith("Period is too long")
    })
    it("should revert if the option type is not a call or put", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .createFor(await alice.getAddress(), 1209600, 1, 1, 0),
      ).to.be.revertedWith("Wrong option type")
    })
    it("should set the strike to the current price if 0 is given", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 0, 1)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.strike).to.eq(BN.from(50000e8))
    })
    it("should create a put correctly", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(BN.from(50000e8))
      expect(option.amount).to.eq(BN.from(1))
      // Work out how to test this
      // expect(option.expiration).to.eq(BN.from(1))
      expect(option.optionType).to.eq(BN.from(1))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })

    it("should create a call correctly", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 2)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(BN.from(50000e8))
      expect(option.amount).to.eq(BN.from(1))
      // Work out how to test this
      // expect(option.expiration).to.eq(BN.from(1))
      expect(option.optionType).to.eq(BN.from(2))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })

    it("should emit a Create event with correct values", async () => {
      await expect(
        hegicOptions
          .connect(alice)
          .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 2),
      )
        .to.emit(hegicOptions, "Create")
        .withArgs(BN.from(0), await alice.getAddress(), BN.from(0), BN.from(0))
    })
  })

  describe("exercise", async () => {
    it("should revert if the option exerciser is not approved or the owner", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)

      await expect(
        hegicOptions.connect(bob).exercise(BN.from(0)),
      ).to.be.revertedWith("msg.sender can't exercise this option")
    })

    it("should revert if the option has expired", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])

      await expect(
        hegicOptions.connect(alice).exercise(BN.from(0)),
      ).to.be.revertedWith("Option has expired")
    })

    it("should revert if the option is in the wrong state", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      expect(hegicOptions.connect(alice).exercise(BN.from(0)))
      await expect(
        hegicOptions.connect(alice).exercise(BN.from(0)),
      ).to.be.revertedWith("Wrong state")
    })

    it("should set the option state to exercised", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      expect(hegicOptions.connect(alice).exercise(BN.from(0)))
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(2))
    })

    it("should pay profits correctly for put option", async () => {
      const amount = ethers.utils.parseUnits("1", await fakeWBTC.decimals())
      const strike = 50000e8
      const exercisePrice = 40000e8

      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, amount, strike, 1)
      await fakePriceProvider.setPrice(exercisePrice)
      const beforeBalance = await fakeUSDC.balanceOf(await alice.getAddress())
      const tx = await hegicOptions
        .connect(alice)
        .exercise(0)
        .then((x) => x.wait())
      const profit = tx?.events?.find((x) => x.event === "Exercise")?.args
        ?.profit as BN

      const afterBalance = await fakeUSDC.balanceOf(await alice.getAddress())
      const expectedProfit = amount
        .mul(strike - exercisePrice)
        .mul(1e6)
        .div(1e8)
        .div(1e8)

      expect(afterBalance.sub(beforeBalance))
        .to.equal(profit, "Wrong profit")
        .to.equal(expectedProfit, "Wrong expected profit")
    })

    it("should emit a Exercise event with correct values", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)

      await expect(hegicOptions.connect(alice).exercise(BN.from(0)))
        .to.emit(hegicOptions, "Exercise")
        .withArgs(BN.from(0), BN.from(0))
    })
  })

  describe("unlock", async () => {
    it("should revert if the option has not expired", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)

      await expect(hegicOptions.unlock(BN.from(0))).to.be.revertedWith(
        "Option has not expired yet",
      )
    })
    it("should revert if the option is not active", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicOptions.unlock(BN.from(0))
      await expect(hegicOptions.unlock(BN.from(0))).to.be.revertedWith(
        "Option is not active",
      )
    })
    it("should set the option state to Expired", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicOptions.unlock(BN.from(0))
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(3))
    })
    it("should unlock liquidity from the pool", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      const option = await hegicOptions.options(BN.from(0))
      const liquidityAmount = await hegicPoolUSDC
        .lockedLiquidity(option.lockedLiquidityID)
        .then((x) => x.amount)
      const lockedBefore = await hegicPoolUSDC.lockedAmount()
      await hegicOptions.unlock(BN.from(0))
      const lockedAfter = await hegicPoolUSDC.lockedAmount()
      expect(lockedBefore.sub(lockedAfter)).to.eq(liquidityAmount)
    })
    it("should emit an Expire event with correct values", async () => {
      await hegicOptions
        .connect(alice)
        .createFor(await alice.getAddress(), 1209600, 1, 50000e8, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await expect(hegicOptions.unlock(BN.from(0)))
        .to.emit(hegicOptions, "Expire")
        .withArgs(BN.from(0))
    })
  })
})
