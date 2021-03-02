import {ethers} from "hardhat"
import {BigNumber as BN} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../typechain/HegicPool"

chai.use(solidity)
const {expect} = chai

describe("HegicPool", async () => {
  let hegicPool: HegicPool
  const token = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
  const name = "WBTC"

  beforeEach(async () => {
    const hegicPoolFactory = await ethers.getContractFactory("HegicPool")
    hegicPool = (await hegicPoolFactory.deploy(token, name, name)) as HegicPool
    await hegicPool.deployed()
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await hegicPool.INITIAL_RATE()).to.be.eq(BN.from(10).pow(20))
      expect(await hegicPool.lockupPeriod()).to.be.eq(BN.from(1209600))
      expect(await hegicPool.hedgeFeeRate()).to.be.eq(BN.from(80))
      expect(await hegicPool.lockedAmount()).to.be.eq(BN.from(0))
      expect(await hegicPool.unhedgedShare()).to.be.eq(BN.from(0))
      expect(await hegicPool.hedgedShare()).to.be.eq(BN.from(0))
      expect(await hegicPool.unhedgedBalance()).to.be.eq(BN.from(0))
      expect(await hegicPool.hedgedBalance()).to.be.eq(BN.from(0))
      expect(await hegicPool.hedgePool()).to.be.eq(BN.from(0))
      // expect(await hegicPool.tranches()).to.be.eq(BN.from(0))
      // expect(await hegicPool.lockedLiquidity()).to.be.eq(BN.from(0))
      expect(await hegicPool.token()).to.be.eq(token)
    })
  })

  describe("setLockupPeriod", async () => {
    it("should fail if the caller is not owner", async () => {
      const [owner, addr1] = await ethers.getSigners()
      await expect(
        hegicPool.connect(addr1).setLockupPeriod(BN.from(10))
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should fail if the period is greater than 60 days", async () => {
      await expect(
        hegicPool.setLockupPeriod(BN.from(5184001))
      ).to.be.revertedWith("Lockup period is too long")
    })

    it("should set the lockupPeriod correctly", async () => {
      const lockupPeriodBefore = await hegicPool.lockupPeriod()
      expect(lockupPeriodBefore).to.equal(BN.from(1209600))
      await hegicPool.setLockupPeriod(5184000)
      const lockupPeriodAfter = await hegicPool.lockupPeriod()
      expect(lockupPeriodAfter.toNumber()).to.be.eq(BN.from(5184000))
    })
  })
})
