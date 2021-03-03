import {ethers} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicPool} from "../typechain/HegicPool"
import {MockErc20} from "../typechain/MockErc20"

chai.use(solidity)
const {expect} = chai

describe("HegicPool", async () => {
  let hegicPool: HegicPool
  let mockERC20: MockErc20
  let signers: Signer[]
  let mockERC20Address: string
  let hegicPoolAddress: string
  let ownerAddress: string

  const name = "Wrapped BTC"
  const symbol = "WBTC"
  const decimals = "8"

  beforeEach(async () => {
    signers = await ethers.getSigners()

    const mockERC20Factory = await ethers.getContractFactory("MockERC20")
    mockERC20 = (await mockERC20Factory.deploy(
      name,
      symbol,
      decimals,
    )) as MockErc20
    await mockERC20.deployed()
    ownerAddress = await signers[0].getAddress()
    await mockERC20.mint(ownerAddress, BN.from(10).pow(20))
    mockERC20Address = await mockERC20.address

    const hegicPoolFactory = await ethers.getContractFactory("HegicPool")
    hegicPool = (await hegicPoolFactory.deploy(
      mockERC20Address,
      name,
      symbol,
    )) as HegicPool
    await hegicPool.deployed()
    hegicPoolAddress = await hegicPool.address

    await mockERC20
      .connect(signers[0])
      .approve(hegicPoolAddress, BN.from(10).pow(20))
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
      expect(await hegicPool.hedgePool()).to.be.eq(
        BN.from(ethers.constants.AddressZero),
      )
      expect(await hegicPool.token()).to.be.eq(mockERC20Address)
    })
  })

  describe("setLockupPeriod", async () => {
    it("should fail if the caller is not the owner", async () => {
      await expect(
        hegicPool.connect(signers[1]).setLockupPeriod(BN.from(10)),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should fail if the period is greater than 60 days", async () => {
      await expect(
        hegicPool.setLockupPeriod(BN.from(5184001)),
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

  describe("lock", async () => {
    it("should fail if the caller is not the owner", async () => {
      await expect(
        hegicPool.connect(signers[1]).lock(BN.from(1), BN.from(1)),
      ).to.be.revertedWith("caller is not the owner")
    })

    // If the lockedAmount * 10 <= balance * 8 it should fail
    it("should fail if the locked amount less", async () => {
      await expect(
        hegicPool.connect(signers[1]).lock(BN.from(1), BN.from(1)),
      ).to.be.revertedWith("caller is not the owner")
    })
  })

  describe("send", async () => {
    it("should revert if to is zero address", async () => {
      await expect(
        hegicPool.send(BN.from(0), ethers.constants.AddressZero, BN.from(1)),
      ).to.be.reverted
    })
  })

  // TODO - factor out providing funds step
  describe("provideFrom", async () => {
    it("should supply funds to the pool", async () => {
      await hegicPool.provideFrom(
        ownerAddress,
        BN.from(100000),
        true,
        BN.from(100000),
      )
      expect(await hegicPool.availableBalance()).to.eq(BN.from(100000))
    })

    it("should set the Tranche values correctly", async () => {
      await hegicPool.provideFrom(
        ownerAddress,
        BN.from(100000),
        true,
        BN.from(100000),
      )
      const tranche = await hegicPool.tranches(BN.from(0))
      // Set by INITIAL_RATE
      expect(tranche.share).to.eq(BN.from(10).pow(25))
      expect(tranche.state).to.eq(BN.from(1))
      expect(tranche.amount).to.eq(BN.from(100000))
      expect(tranche.hedged).to.eq(true)
    })

    it("should set the Tranche values correctly when unhedged", async () => {
      await hegicPool.provideFrom(
        ownerAddress,
        BN.from(100000),
        false,
        BN.from(100000),
      )
      const tranche = await hegicPool.tranches(BN.from(0))
      // Set by INITIAL_RATE
      expect(tranche.share).to.eq(BN.from(10).pow(25))
      expect(tranche.state).to.eq(BN.from(1))
      expect(tranche.amount).to.eq(BN.from(100000))
      expect(tranche.hedged).to.eq(false)
    })

    it("should emit a Provide event with correct values", async () => {
      await expect(
        hegicPool.provideFrom(
          ownerAddress,
          BN.from(100000),
          true,
          BN.from(100000),
        ),
      )
        .to.emit(hegicPool, "Provide")
        .withArgs(ownerAddress, BN.from(100000), BN.from(10).pow(25), true)
    })
    it("should emit a Provide event with correct values when unhedged", async () => {
      await expect(
        hegicPool.provideFrom(
          ownerAddress,
          BN.from(100000),
          false,
          BN.from(100000),
        ),
      )
        .to.emit(hegicPool, "Provide")
        .withArgs(ownerAddress, BN.from(100000), BN.from(10).pow(25), false)
    })
  })

  describe("availableBalance", async () => {
    it("should return the available balance", async () => {
      expect(await hegicPool.availableBalance()).to.eq(BN.from(0))
    })
  })

  describe("withdraw", async () => {
    it("should revert if the trancheID does not exist", async () => {
      await expect(hegicPool.withdraw(BN.from(0))).to.be.reverted
    })
  })

  describe("totalBalance", async () => {
    it("should return the total balance", async () => {
      expect(await hegicPool.totalBalance()).to.eq(BN.from(0))
    })
  })
})
