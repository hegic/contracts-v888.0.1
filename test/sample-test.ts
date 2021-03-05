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
  let aliceAddress: string

  const name = "Wrapped BTC"
  const symbol = "WBTC"
  const decimals = "8"

  beforeEach(async () => {
    signers = await ethers.getSigners()
    ownerAddress = await signers[0].getAddress()
    aliceAddress = await signers[1].getAddress()

    const mockERC20Factory = await ethers.getContractFactory("MockERC20")
    mockERC20 = (await mockERC20Factory.deploy(
      name,
      symbol,
      decimals,
    )) as MockErc20
    await mockERC20.deployed()
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
      expect(await hegicPool.hedgeFeeRate()).to.be.eq(BN.from(0))
      expect(await hegicPool.lockedAmount()).to.be.eq(BN.from(0))
      expect(await hegicPool.unhedgedShare()).to.be.eq(BN.from(0))
      expect(await hegicPool.hedgedShare()).to.be.eq(BN.from(0))
      expect(await hegicPool.unhedgedBalance()).to.be.eq(BN.from(0))
      expect(await hegicPool.hedgedBalance()).to.be.eq(BN.from(0))
      expect(await hegicPool.hedgePool()).to.be.eq(BN.from(ownerAddress))
      expect(await hegicPool.token()).to.be.eq(mockERC20Address)
    })
  })

  describe("setLockupPeriod", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicPool.connect(signers[1]).setLockupPeriod(BN.from(10)),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if the period is greater than 60 days", async () => {
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

  describe("setHedgePool", async () => {
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicPool.connect(signers[1]).setHedgePool(aliceAddress),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if the address is the zero address", async () => {
      await expect(hegicPool.setHedgePool(ethers.constants.AddressZero)).to.be
        .reverted
    })

    it("should set the hedgePool correctly", async () => {
      const hedgePoolBefore = await hegicPool.hedgePool()
      expect(hedgePoolBefore).to.equal(ownerAddress)
      await hegicPool.setHedgePool(aliceAddress)
      const hedgePoolAfter = await hegicPool.hedgePool()
      expect(hedgePoolAfter).to.be.eq(aliceAddress)
    })
  })

  describe("lock", async () => {
    beforeEach(async () => {
      await hegicPool.provideFrom(
        ownerAddress,
        BN.from(100000),
        true,
        BN.from(100000),
      )
    })
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicPool.connect(signers[1]).lock(BN.from(1), BN.from(1)),
      ).to.be.revertedWith("caller is not the owner")
    })

    // If the lockedAmount * 10 <= balance * 8 it should revert
    it("should revert if the locked amount is too large", async () => {
      await expect(
        // Balance is 100000 * 8 = 800000
        // Locked amount is 90000 * 10 = 900000
        hegicPool.lock(BN.from(90000), BN.from(1)),
      ).to.be.revertedWith("Pool Error: Amount is too large")
    })

    it("should create lockup liquidity", async () => {
      // Premium = premium * hedgedBalance / balance
      // 10 * 10000 / 10000
      await hegicPool.lock(BN.from(10000), BN.from(0))
      const ll = await hegicPool.lockedLiquidity(BN.from(0))
      expect(ll.amount).to.eq(BN.from(10000))
      expect(ll.hedgePremium).to.eq(BN.from(0))
      expect(ll.unhedgePremium).to.eq(BN.from(0))
      expect(ll.locked).to.eq(true)
    })
  })

  describe("unlock", async () => {
    beforeEach(async () => {
      await hegicPool.provideFrom(
        ownerAddress,
        BN.from(100000),
        true,
        BN.from(100000),
      )
    })
    it("should revert if the caller is not the owner", async () => {
      await expect(
        hegicPool.connect(signers[1]).unlock(BN.from(0)),
      ).to.be.revertedWith("caller is not the owner")
    })

    it("should revert if locked liquidity id does not exist", async () => {
      await expect(hegicPool.unlock(BN.from(0))).to.be.reverted
    })

    it("should revert if locked liquidity has already been unlocked", async () => {
      await hegicPool.lock(BN.from(10000), BN.from(0))
      await hegicPool.unlock(BN.from(0))
      await expect(hegicPool.unlock(BN.from(0))).to.be.revertedWith(
        "LockedLiquidity with such id has already been unlocked",
      )
    })

    it("should set values correctly", async () => {
      // Premium = premium * hedgedBalance / balance
      // 10 * 10000 / 10000
      await hegicPool.lock(BN.from(10000), BN.from(0))
      const lockedAmountBefore = await hegicPool.lockedAmount()
      const llBefore = await hegicPool.lockedLiquidity(BN.from(0))
      expect(lockedAmountBefore).to.eq(BN.from(10000))
      expect(llBefore.locked).to.eq(true)

      await hegicPool.unlock(BN.from(0))

      const lockedAmountAfter = await hegicPool.lockedAmount()
      const llAfter = await hegicPool.lockedLiquidity(BN.from(0))
      expect(lockedAmountAfter).to.eq(BN.from(0))
      expect(llAfter.locked).to.eq(false)
    })

    it("should emit a Profit event with correct values", async () => {
      await hegicPool.lock(BN.from(10000), BN.from(0))
      await expect(hegicPool.unlock(BN.from(0)))
        .to.emit(hegicPool, "Profit")
        .withArgs(BN.from(0), BN.from(0), BN.from(0))
    })
  })

  describe("send", async () => {
    beforeEach(async () => {
      await hegicPool.provideFrom(
        ownerAddress,
        BN.from(100000),
        true,
        BN.from(100000),
      )
    })

    it("should revert if to is zero address", async () => {
      await expect(
        hegicPool.send(BN.from(0), ethers.constants.AddressZero, BN.from(1)),
      ).to.be.reverted
    })

    it("should revert if the locked liquidity id does not exist", async () => {
      await expect(hegicPool.send(BN.from(0), ownerAddress, BN.from(100000))).to
        .be.reverted
    })

    it("should emit a Loss event with correct data", async () => {
      await hegicPool.lock(BN.from(10000), BN.from(0))
      await expect(hegicPool.send(BN.from(0), ownerAddress, BN.from(100000)))
        .to.emit(hegicPool, "Loss")
        .withArgs(BN.from(0), BN.from(10000), BN.from(0))
    })

    it("should transfer tokens correctly", async () => {
      const balanceBefore = await mockERC20.balanceOf(ownerAddress)
      // Minted value minus amount pooled in beforeEach block
      expect(balanceBefore).to.equal(BN.from(10).pow(20).sub(100000))
      await hegicPool.lock(BN.from(10000), BN.from(0))
      await hegicPool.send(BN.from(0), ownerAddress, BN.from(10000))
      const balanceAfter = await mockERC20.balanceOf(ownerAddress)
      expect(balanceAfter).to.equal(BN.from(balanceBefore).add(BN.from(10000)))
    })

    it("should transfer the locked amount if amount is greater", async () => {
      const balanceBefore = await mockERC20.balanceOf(ownerAddress)
      // Minted value minus amount pooled in beforeEach block
      expect(balanceBefore).to.equal(BN.from(10).pow(20).sub(100000))
      await hegicPool.lock(BN.from(10000), BN.from(0))
      await hegicPool.send(BN.from(0), ownerAddress, BN.from(8888888888))
      const balanceAfter = await mockERC20.balanceOf(ownerAddress)
      expect(balanceAfter).to.equal(BN.from(balanceBefore).add(BN.from(10000)))
    })

    it("should emit a Profit event with correct data", async () => {
      await hegicPool.lock(BN.from(10000), BN.from(10))
      await expect(hegicPool.send(BN.from(0), ownerAddress, BN.from(1)))
        .to.emit(hegicPool, "Profit")
        .withArgs(BN.from(0), BN.from(9), BN.from(0))
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

    it("should revert if the mintShare is too large", async () => {
      await expect(
        hegicPool.provideFrom(
          ownerAddress,
          BN.from(10),
          true,
          BN.from(10).pow(50),
        ),
      ).to.be.revertedWith("Pool: Mint limit is too large")
    })

    it("should revert if the mint limit is too large", async () => {
      await expect(
        hegicPool.provideFrom(ownerAddress, BN.from(0), true, BN.from(0)),
      ).to.be.revertedWith("Pool: Amount is too small")
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

    // it("should revert when the tranche is locked up", async () => {
    //   await hegicPool.provideFrom(
    //     ownerAddress,
    //     BN.from(100000),
    //     true,
    //     BN.from(100000),
    //   )
    // tranche share - 10000000000000000000000000
    // hedged balance - 100000
    // hedged share - 10000000000000000000000000

    //   await expect(hegicPool.withdraw(BN.from(0))).to.be.revertedWith(
    //     "Pool: Withdrawal is locked up",
    //   )
    // })
  })

  describe("totalBalance", async () => {
    it("should return the total balance", async () => {
      expect(await hegicPool.totalBalance()).to.eq(BN.from(0))
    })
  })
})
