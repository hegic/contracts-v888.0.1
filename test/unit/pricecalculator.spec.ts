import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {Erc20Mock} from "../../typechain/Erc20Mock"
import {PriceCalculator} from "../../typechain/PriceCalculator"
import {PriceProviderMock} from "../../typechain/PriceProviderMock"

chai.use(solidity)
const {expect} = chai

describe("PriceCalculator", async () => {
  // let hegicPoolWBTC: HegicPool
  // let hegicPoolUSDC: HegicPool
  let priceCalculator: PriceCalculator
  let fakeWBTC: Erc20Mock
  let fakePriceProvider: PriceProviderMock
  let alice: Signer

  beforeEach(async () => {
    await deployments.fixture()
    ;[, alice] = await ethers.getSigners()

    fakeWBTC = (await ethers.getContract("WBTC")) as Erc20Mock

    const hegicPoolWBTC = (await ethers.getContract(
      "HegicWBTCPool",
    )) as HegicPool
    const hegicPoolUSDC = (await ethers.getContract(
      "HegicUSDCPool",
    )) as HegicPool

    const USDC = (await ethers.getContract("USDC")) as Erc20Mock
    await USDC.connect(alice).approve(
      hegicPoolUSDC.address,
      ethers.constants.MaxUint256,
    )

    fakePriceProvider = (await ethers.getContract(
      "WBTCPriceProvider",
    )) as PriceProviderMock
    priceCalculator = (await ethers.getContract(
      "WBTCPriceCalculator",
    )) as PriceCalculator

    await fakeWBTC.mintTo(await alice.getAddress(), BN.from(10).pow(20))
    await USDC.connect(alice).mint(BN.from(10).pow(15))

    await fakeWBTC
      .connect(alice)
      .approve(hegicPoolWBTC.address, ethers.constants.MaxUint256)

    await hegicPoolWBTC
      .connect(alice)
      .provideFrom(await alice.getAddress(), 100000, true, 100000)

    await hegicPoolUSDC
      .connect(alice)
      .provideFrom(await alice.getAddress(), 1e12, true, 1e12)
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
        BN.from(100000000),
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
          BN.from(50000e8),
          BN.from(1),
        )
        expect(feeResponse.settlementFee).to.be.eq(BN.from(50000))
        expect(feeResponse.premium).to.be.eq(BN.from(0))
      })

      it("should return correct values for a call", async () => {
        const feeResponse = await priceCalculator.fees(
          BN.from(604800),
          BN.from(100),
          BN.from(50000e8),
          BN.from(2),
        )
        expect(feeResponse.settlementFee).to.be.eq(BN.from(1))
        expect(feeResponse.premium).to.be.eq(BN.from(7))
      })
    })
  })
})
