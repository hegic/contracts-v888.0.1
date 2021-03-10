import {ethers} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {FakeWbtc} from "../../typechain/FakeWbtc"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {FakePriceProvider} from "../../typechain/FakePriceProvider"

chai.use(solidity)
const {expect} = chai

describe("PriceCalculator", async () => {
  let hegicPoolWBTC: HegicPool
  let priceCalculator: PriceCalculator
  let fakeWBTC: FakeWbtc
  let fakePriceProvider: FakePriceProvider
  let deployer: Signer
  let alice: Signer

  beforeEach(async () => {
    ;[deployer, alice] = await ethers.getSigners()

    const fakeWbtcFactory = await ethers.getContractFactory("FakeWBTC")
    fakeWBTC = (await fakeWbtcFactory.connect(deployer).deploy()) as FakeWbtc
    await fakeWBTC.deployed()
    await fakeWBTC.mintTo(await alice.getAddress(), BN.from(10).pow(20))

    const fakePriceProviderFactory = await ethers.getContractFactory(
      "FakePriceProvider",
    )
    fakePriceProvider = (await fakePriceProviderFactory
      .connect(deployer)
      .deploy(BN.from(50000))) as FakePriceProvider
    await fakePriceProvider.deployed()

    const hegicPoolWBTCFactory = await ethers.getContractFactory("HegicPool")
    hegicPoolWBTC = (await hegicPoolWBTCFactory
      .connect(deployer)
      .deploy(await fakeWBTC.address, "writeWBTC", "wWBTC")) as HegicPool
    await hegicPoolWBTC.deployed()

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

    await fakeWBTC
      .connect(alice)
      .approve(await hegicPoolWBTC.address, await ethers.constants.MaxUint256)

    await hegicPoolWBTC
      .connect(alice)
      .provideFrom(
        await alice.getAddress(),
        BN.from(100000),
        true,
        BN.from(100000),
      )
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await priceCalculator.impliedVolRate(BN.from(0))).to.be.eq(
        BN.from(9000),
      )
      expect(await priceCalculator.impliedVolRate(BN.from(1))).to.be.eq(
        BN.from(10000),
      )
      expect(await priceCalculator.impliedVolRate(BN.from(2))).to.be.eq(
        BN.from(20000),
      )
      expect(await priceCalculator.utilizationRate()).to.be.eq(
        BN.from(200000000),
      )
      expect(await priceCalculator.priceProvider()).to.be.eq(
        fakePriceProvider.address,
      )
    })

    describe("setImpliedVolRate", async () => {
      it("should revert if the caller is not the owner", async () => {
        await expect(
          priceCalculator
            .connect(alice)
            .setImpliedVolRate([
              BN.from(10000),
              BN.from(11000),
              BN.from(22000),
            ]),
        ).to.be.revertedWith("caller is not the owner")
      })

      it("should set the impliedVolRate correctly", async () => {
        const impliedVolRateBefore = await priceCalculator.impliedVolRate(1)
        expect(impliedVolRateBefore).to.be.eq(BN.from(10000))
        await priceCalculator.setImpliedVolRate([
          BN.from(10000),
          BN.from(11000),
          BN.from(22000),
        ])
        const impliedVolRateAfter = await priceCalculator.impliedVolRate(1)
        expect(impliedVolRateAfter).to.be.eq(BN.from(11000))
      })
    })

    describe("fees", async () => {
      it("should revert if the strike is not the current price", async () => {
        await expect(
          priceCalculator.fees(
            BN.from(604800),
            BN.from(100),
            BN.from(50100),
            BN.from(1),
          ),
        ).to.be.revertedWith("Only ATM options are currently available")
      })

      it("should return correct values for a put", async () => {
        const feeResponse = await priceCalculator.fees(
          BN.from(604800),
          BN.from(100),
          BN.from(50000),
          BN.from(1),
        )
        expect(feeResponse.settlementFee).to.be.eq(BN.from(1))
        expect(feeResponse.premium).to.be.eq(BN.from(0))
      })

      it("should return correct values for a call", async () => {
        const feeResponse = await priceCalculator.fees(
          BN.from(604800),
          BN.from(100),
          BN.from(50000),
          BN.from(2),
        )
        expect(feeResponse.settlementFee).to.be.eq(BN.from(1))
        expect(feeResponse.premium).to.be.eq(BN.from(7))
      })
    })
  })
})
