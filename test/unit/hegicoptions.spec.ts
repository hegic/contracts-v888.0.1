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
import {TestAccounts} from "../helpers/testAccounts"

chai.use(solidity)
const {expect} = chai

describe("HegicPool", async () => {
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
  let signers: Signer[]
  let accounts: TestAccounts

  beforeEach(async () => {
    signers = await ethers.getSigners()
    accounts = await new TestAccounts().initAccounts(signers)

    const fakeHegicFactory = await ethers.getContractFactory("FakeHEGIC")
    fakeHegic = (await fakeHegicFactory.deploy()) as FakeHegic
    await fakeHegic.deployed()
    await fakeHegic.mintTo(accounts.owner.address, BN.from(10).pow(20))

    const fakeUsdcFactory = await ethers.getContractFactory("FakeUSDC")
    fakeUSDC = (await fakeUsdcFactory.deploy()) as FakeUsdc
    await fakeUSDC.deployed()
    await fakeUSDC.mintTo(accounts.owner.address, BN.from(10).pow(20))

    const fakeWbtcFactory = await ethers.getContractFactory("FakeWBTC")
    fakeWBTC = (await fakeWbtcFactory.deploy()) as FakeWbtc
    await fakeWBTC.deployed()
    await fakeWBTC.mintTo(accounts.owner.address, BN.from(10).pow(20))

    const fakePriceProviderFactory = await ethers.getContractFactory(
      "FakePriceProvider",
    )
    fakePriceProvider = (await fakePriceProviderFactory.deploy(
      BN.from(50000),
    )) as FakePriceProvider
    await fakePriceProvider.deployed()

    const hegicPoolWBTCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolWBTC = (await hegicPoolWBTCFactory.deploy(
      await fakeWBTC.address,
      "writeWBTC",
      "wWBTC",
    )) as HegicPool
    await hegicPoolWBTC.deployed()

    const hegicPoolUSDCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolUSDC = (await hegicPoolUSDCFactory.deploy(
      await fakeUSDC.address,
      "writeUSDC",
      "wUSDC",
    )) as HegicPool
    await hegicPoolUSDC.deployed()

    const hegicStakingWBTCFactory = await ethers.getContractFactory(
      "HegicStaking",
    )
    hegicStakingWBTC = (await hegicStakingWBTCFactory.deploy(
      await fakeHegic.address,
      await fakeWBTC.address,
      "Hegic WBTC Lot",
      "hlWBTC",
    )) as HegicStaking
    await hegicStakingWBTC.deployed()

    const hegicStakingUSDCFactory = await ethers.getContractFactory(
      "HegicStaking",
    )
    hegicStakingUSDC = (await hegicStakingUSDCFactory.deploy(
      await fakeHegic.address,
      await fakeUSDC.address,
      "Hegic USDC Lot",
      "hlUSDC",
    )) as HegicStaking
    await hegicStakingUSDC.deployed()

    const priceCalculatorFactory = await ethers.getContractFactory(
      "PriceCalculator",
    )
    priceCalculator = (await priceCalculatorFactory.deploy(
      [9000, 10000, 20000],
      await fakePriceProvider.address,
      await hegicPoolWBTC.address,
      6,
    )) as PriceCalculator
    await priceCalculator.deployed()

    const hegicOptionsFactory = await ethers.getContractFactory("HegicOptions")
    hegicOptions = (await hegicOptionsFactory.deploy(
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

    await hegicPoolWBTC.transferOwnership(await hegicOptions.address)
    await hegicPoolUSDC.transferOwnership(await hegicOptions.address)

    await fakeWBTC
      .connect(accounts.owner.signer)
      .approve(await hegicPoolWBTC.address, BN.from(10).pow(20))

    await hegicPoolWBTC.provideFrom(
      accounts.owner.address,
      BN.from(100000),
      true,
      BN.from(100000),
    )

    await fakeUSDC
      .connect(accounts.owner.signer)
      .approve(await hegicPoolUSDC.address, BN.from(10).pow(20))

    await hegicPoolUSDC.provideFrom(
      accounts.owner.address,
      BN.from(100000),
      true,
      BN.from(100000),
    )
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await hegicOptions.priceCalculator()).to.be.eq(
        ethers.constants.AddressZero,
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

  describe("transferPoolsOwnership", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions.connect(accounts.user1.signer).transferPoolsOwnership(),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if it is called after the BETA period", async () => {
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await expect(hegicOptions.transferPoolsOwnership()).to.be.reverted
    })

    it("should transfer ownership of the pools", async () => {
      await hegicOptions.transferPoolsOwnership()
      expect(await hegicPoolUSDC.owner()).to.be.eq(await hegicOptions.owner())
      expect(await hegicPoolWBTC.owner()).to.be.eq(await hegicOptions.owner())
    })
  })

  describe("updateSettlementFeeRecipients", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions
          .connect(accounts.user1.signer)
          .updateSettlementFeeRecipients(
            accounts.user2.address,
            accounts.user3.address,
          ),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if zero address is given for recipientPut", async () => {
      await expect(
        hegicOptions.updateSettlementFeeRecipients(
          ethers.constants.AddressZero,
          accounts.user3.address,
        ),
      ).to.be.reverted
    })

    it("should revert if zero address is given for recipientCall", async () => {
      await expect(
        hegicOptions.updateSettlementFeeRecipients(
          accounts.user2.address,
          ethers.constants.AddressZero,
        ),
      ).to.be.reverted
    })

    it("should update the settlement fee recipients", async () => {
      await hegicOptions.updateSettlementFeeRecipients(
        accounts.user2.address,
        accounts.user3.address,
      )

      expect(await hegicOptions.settlementFeeRecipient(BN.from(1))).to.eq(
        accounts.user2.address,
      )

      expect(await hegicOptions.settlementFeeRecipient(BN.from(2))).to.eq(
        accounts.user3.address,
      )
    })
  })

  describe("updatePriceCalculator", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicOptions
          .connect(accounts.user1.signer)
          .updatePriceCalculator(await priceCalculator.address),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should update the priceCalculator correctly", async () => {
      const priceCalculatorBefore = await hegicOptions.priceCalculator()
      expect(priceCalculatorBefore).to.be.eq(ethers.constants.AddressZero)
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      const priceCalculatorAfter = await hegicOptions.priceCalculator()
      expect(priceCalculatorAfter).to.be.eq(await priceCalculator.address)
    })
  })

  describe("createFor", async () => {
    // TODO test line 130
    it("should revert if the strike is less than 1 day", async () => {
      await expect(
        hegicOptions.createFor(accounts.user1.address, 1, 1, 1, 1),
      ).to.be.revertedWith("Period is too short")
    })
    it("should revert if the strike is greater than 12 weeks", async () => {
      // Test for 13 weeks
      await expect(
        hegicOptions.createFor(accounts.user1.address, 7862400, 1, 1, 1),
      ).to.be.revertedWith("Period is too long")
    })
    it("should revert if the option type is not a call or put", async () => {
      await expect(
        hegicOptions.createFor(accounts.user1.address, 1209600, 1, 1, 0),
      ).to.be.revertedWith("Wrong option type")
    })
    it("should set the strike to the current price if 0 is given", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 0, 1)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.strike).to.eq(BN.from(50000))
    })
    it("should create a put correctly", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(BN.from(50000))
      expect(option.amount).to.eq(BN.from(1))
      // Work out how to test this
      // expect(option.expiration).to.eq(BN.from(1))
      expect(option.optionType).to.eq(BN.from(1))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })

    it("should create a call correctly", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 2)
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(1))
      expect(option.strike).to.eq(BN.from(50000))
      expect(option.amount).to.eq(BN.from(1))
      // Work out how to test this
      // expect(option.expiration).to.eq(BN.from(1))
      expect(option.optionType).to.eq(BN.from(2))
      expect(option.lockedLiquidityID).to.eq(BN.from(0))
    })

    it("should emit a Create event with correct values", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)

      await expect(
        hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 2),
      )
        .to.emit(hegicOptions, "Create")
        .withArgs(BN.from(0), accounts.owner.address, BN.from(0), BN.from(0))
    })
  })

  describe("exercise", async () => {
    it("should revert if the option exerciser is not approved or the owner", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)

      await expect(
        hegicOptions.connect(accounts.user1.signer).exercise(BN.from(0)),
      ).to.be.revertedWith("msg.sender can't exercise this option")
    })

    it("should revert if the option has expired", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])

      await expect(hegicOptions.exercise(BN.from(0))).to.be.revertedWith(
        "Option has expired",
      )
    })

    it("should revert if the option is in the wrong state", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
      await expect(hegicOptions.exercise(BN.from(0)))
      await expect(hegicOptions.exercise(BN.from(0))).to.be.revertedWith(
        "Wrong state",
      )
    })

    it("should set the option state to exercised", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
      await expect(hegicOptions.exercise(BN.from(0)))
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(2))
    })

    xit("should pay any profits", async () => {})

    it("should emit a Exercise event with correct values", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)

      await expect(hegicOptions.exercise(BN.from(0)))
        .to.emit(hegicOptions, "Exercise")
        .withArgs(BN.from(0), BN.from(0))
    })
  })

  describe("unlock", async () => {
    it("should revert if the option has not expired", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)

      await expect(hegicOptions.unlock(BN.from(0))).to.be.revertedWith(
        "Option has not expired yet",
      )
    })
    it("should revert if the option is not active", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
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
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
      // Move forward 360 days
      await ethers.provider.send("evm_increaseTime", [
        BN.from(31104000).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicOptions.unlock(BN.from(0))
      const option = await hegicOptions.options(BN.from(0))
      expect(option.state).to.eq(BN.from(3))
    })
    xit("should unlock liquidity from the pool", async () => {})
    it("should emit an Expire event with correct values", async () => {
      await hegicOptions.updatePriceCalculator(await priceCalculator.address)
      await hegicOptions.createFor(accounts.owner.address, 1209600, 1, 50000, 1)
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
