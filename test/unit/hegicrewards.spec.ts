import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../../typechain/HegicPool"
import {HegicOptions} from "../../typechain/HegicOptions"
import {Erc20Mock} from "../../typechain/Erc20Mock"
import {HegicRewards} from "../../typechain/HegicRewards"

chai.use(solidity)
const {expect} = chai

describe("HegicRewards", async () => {
  let hegicPoolWBTC: HegicPool
  let hegicPoolUSDC: HegicPool
  let hegicOptions: HegicOptions
  let fakeHegic: Erc20Mock
  let fakeUSDC: Erc20Mock
  let fakeWBTC: Erc20Mock
  let hegicRewards: HegicRewards
  let alice: Signer

  beforeEach(async () => {
    await deployments.fixture()
    ;[, alice] = await ethers.getSigners()

    hegicPoolWBTC = (await ethers.getContract("HegicWBTCPool")) as HegicPool
    hegicPoolUSDC = (await ethers.getContract("HegicUSDCPool")) as HegicPool
    hegicOptions = (await ethers.getContract("WBTCOptions")) as HegicOptions
    fakeHegic = (await ethers.getContract("HEGIC")) as Erc20Mock
    fakeUSDC = (await ethers.getContract("USDC")) as Erc20Mock
    fakeWBTC = (await ethers.getContract("WBTC")) as Erc20Mock
    hegicRewards = (await ethers.getContract("WBTCRewards")) as HegicRewards

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

    await hegicPoolWBTC.transferOwnership(await hegicOptions.address)
    await hegicPoolUSDC.transferOwnership(await hegicOptions.address)

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

    await fakeUSDC
      .connect(alice)
      .approve(await hegicPoolUSDC.address, await ethers.constants.MaxUint256)

    await hegicPoolUSDC
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
      expect(await hegicRewards.hegicOptions()).to.eq(
        await hegicOptions.address,
      )
      expect(await hegicRewards.hegic()).to.eq(await fakeHegic.address)
      expect(await hegicRewards.rewardsRate()).to.eq(BN.from(10).pow(24))
    })
  })

  describe("setRewardsRate", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicRewards.connect(alice).setRewardsRate(BN.from(10).pow(10)),
      ).to.be.revertedWith("caller is not the owner")
    })
    it("should revert if the rewards rate is less than MIN_REWARDS_RATE", async () => {
      await expect(hegicRewards.setRewardsRate(BN.from(10).pow(6))).to.be
        .reverted
    })
    it("should revert if the rewards rate is greater than MAX_REWARDS_RATE", async () => {
      await expect(hegicRewards.setRewardsRate(BN.from(10).pow(25))).to.be
        .reverted
    })
    it("should set the rewards rate correctly", async () => {
      const rewardsRateBefore = await hegicRewards.rewardsRate()
      expect(rewardsRateBefore).to.equal(BN.from(10).pow(24))
      await hegicRewards.setRewardsRate(BN.from(10).pow(10))
      const hedgeRewardsAfter = await hegicRewards.rewardsRate()
      expect(hedgeRewardsAfter).to.be.eq(BN.from(10).pow(10))
    })
  })
})
