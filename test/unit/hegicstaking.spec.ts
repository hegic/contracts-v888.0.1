import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {HegicStaking} from "../../typechain/HegicStaking"
import {Erc20Mock} from "../../typechain/Erc20Mock"

chai.use(solidity)
const {expect} = chai

describe("HegicStaking", async () => {
  let hegicStaking: HegicStaking
  let fakeHegic: Erc20Mock
  let fakeWBTC: Erc20Mock
  let deployer: Signer
  let alice: Signer
  let bob: Signer

  beforeEach(async () => {
    await deployments.fixture()
    ;[deployer, alice, bob] = await ethers.getSigners()

    fakeWBTC = (await ethers.getContract("WBTC")) as Erc20Mock
    fakeHegic = (await ethers.getContract("HEGIC")) as Erc20Mock
    hegicStaking = (await ethers.getContract("WBTCStaking")) as HegicStaking

    await fakeHegic.mintTo(
      await alice.getAddress(),
      await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
    )
    await fakeHegic.mintTo(
      await bob.getAddress(),
      await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
    )

    await fakeWBTC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
    )

    await fakeHegic
      .connect(alice)
      .approve(await hegicStaking.address, await ethers.constants.MaxUint256)

    await fakeHegic
      .connect(bob)
      .approve(await hegicStaking.address, await ethers.constants.MaxUint256)

    await fakeWBTC
      .connect(alice)
      .approve(await hegicStaking.address, await ethers.constants.MaxUint256)
  })

  describe("constructor & settings", async () => {
    it("should set all initial state", async () => {
      expect(await hegicStaking.HEGIC()).to.be.eq(await fakeHegic.address)
      expect(await hegicStaking.token()).to.be.eq(await fakeWBTC.address)
      expect(await hegicStaking.MAX_SUPPLY()).to.be.eq(BN.from(1500))
      expect(await hegicStaking.LOT_PRICE()).to.be.eq(
        await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
      )
      expect(await hegicStaking.FALLBACK_RECIPIENT()).to.be.eq(
        await deployer.getAddress(),
      )
      expect(await hegicStaking.totalProfit()).to.be.eq(BN.from(0))
      expect(await hegicStaking.lockupPeriod()).to.be.eq(BN.from(86400))
      expect(
        await hegicStaking.lastBoughtTimestamp(ethers.constants.AddressZero),
      ).to.be.eq(BN.from(0))
    })
  })

  describe("claimProfit", async () => {
    it("revert if there is zero profit", async () => {
      await expect(
        hegicStaking.connect(alice).claimProfit(),
      ).to.be.revertedWith("Zero profit")
    })
    it("should allow Bob to claim profits", async () => {
      const amount = await ethers.utils.parseUnits(
        "10000",
        await fakeWBTC.decimals(),
      )
      await hegicStaking.connect(alice).buy(BN.from(1))
      await hegicStaking.connect(bob).buy(BN.from(1))
      await hegicStaking.connect(alice).sendProfit(amount)
      const fakeWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await bob.getAddress(),
      )
      expect(fakeWBTCBalanceBefore).to.be.eq(await BN.from(0))
      await hegicStaking.connect(bob).claimProfit()
      const fakeWBTCBalanceAfter = await fakeWBTC.balanceOf(
        await bob.getAddress(),
      )
      expect(fakeWBTCBalanceAfter).to.be.eq(
        await ethers.utils.parseUnits("5000", await fakeWBTC.decimals()),
      )
    })
  })

  describe("buy", async () => {
    it("revert if the amount is zero", async () => {
      await expect(
        hegicStaking.connect(alice).buy(BN.from(0)),
      ).to.be.revertedWith("Amount is zero")
    })
    it("revert if the amount is greater than MAX_SUPPLY", async () => {
      await expect(hegicStaking.connect(alice).buy(BN.from(1500))).to.be
        .reverted
    })
    it("should send HEGIC when buying a lot", async () => {
      const hegicBalanceBefore = await fakeHegic.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicBalanceBefore).to.be.eq(
        await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
      )
      await hegicStaking.connect(alice).buy(BN.from(1))
      const hegicBalanceAfter = await fakeHegic.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicBalanceAfter).to.be.eq(BN.from(0))
    })
    it("should return a token buying a lot", async () => {
      const hegicStakingBalanceBefore = await hegicStaking.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicStakingBalanceBefore).to.be.eq(BN.from(0))
      await hegicStaking.connect(alice).buy(BN.from(1))
      const hegicStakingBalanceAfter = await hegicStaking.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicStakingBalanceAfter).to.be.eq(BN.from(1))
    })
  })

  describe("sell", async () => {
    it("should revert if attempting to sell in the lockup period", async () => {
      await hegicStaking.connect(alice).buy(BN.from(1))
      await expect(
        hegicStaking.connect(alice).sell(BN.from(1)),
      ).to.be.revertedWith("Action suspended due to lockup")
    })
    it("should return HEGIC when selling a lot", async () => {
      await hegicStaking.connect(alice).buy(BN.from(1))
      await ethers.provider.send("evm_increaseTime", [
        BN.from(172800).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicStaking.connect(alice).sell(BN.from(1))
      const hegicBalanceAfter = await fakeHegic.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicBalanceAfter).to.be.eq(
        await ethers.utils.parseUnits("888000", await fakeHegic.decimals()),
      )
    })
    it("should burn the lot token when selling a lot", async () => {
      await hegicStaking.connect(alice).buy(BN.from(1))
      const hegicStakingBalanceBefore = await hegicStaking.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicStakingBalanceBefore).to.be.eq(BN.from(1))
      await ethers.provider.send("evm_increaseTime", [
        BN.from(172800).toNumber(),
      ])
      await ethers.provider.send("evm_mine", [])
      await hegicStaking.connect(alice).sell(BN.from(1))
      const hegicStakingBalanceAfter = await hegicStaking.balanceOf(
        await alice.getAddress(),
      )
      expect(hegicStakingBalanceAfter).to.be.eq(BN.from(0))
    })
  })
  describe("profitOf", async () => {
    it("return the profit for an account", async () => {
      const amount = await ethers.utils.parseUnits(
        "10000",
        await fakeWBTC.decimals(),
      )
      await hegicStaking.connect(alice).buy(BN.from(1))
      await hegicStaking.connect(bob).buy(BN.from(1))
      await hegicStaking.connect(alice).sendProfit(amount)
      const profit = await hegicStaking
        .connect(alice)
        .profitOf(await alice.getAddress())
      expect(profit).to.be.eq(
        await ethers.utils.parseUnits("5000", await fakeWBTC.decimals()),
      )
    })
  })
  describe("sendProfit", async () => {
    it("should allow another account to send profit", async () => {
      await hegicStaking.connect(alice).buy(BN.from(1))
      const fakeWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await alice.getAddress(),
      )
      expect(fakeWBTCBalanceBefore).to.be.eq(
        await ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
      )
      await hegicStaking
        .connect(alice)
        .sendProfit(
          await ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
        )
      const fakeWBTCBalanceAfter = await fakeWBTC.balanceOf(
        await alice.getAddress(),
      )
      expect(fakeWBTCBalanceAfter).to.be.eq(await BN.from(0))
    })
    it("should receive profit sent", async () => {
      await hegicStaking.connect(alice).buy(BN.from(1))
      const fakeWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await hegicStaking.address,
      )
      expect(fakeWBTCBalanceBefore).to.be.eq(await BN.from(0))
      await hegicStaking
        .connect(alice)
        .sendProfit(
          await ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
        )
      const fakeWBTCBalanceAfter = await fakeWBTC.balanceOf(
        await hegicStaking.address,
      )
      expect(fakeWBTCBalanceAfter).to.be.eq(
        await ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
      )
    })
    it("should send to FALLBACK RECIPIENT if there are no lots", async () => {
      const fakeWBTCBalanceBefore = await fakeWBTC.balanceOf(
        await deployer.getAddress(),
      )
      expect(fakeWBTCBalanceBefore).to.be.eq(await BN.from(0))
      await hegicStaking
        .connect(alice)
        .sendProfit(
          await ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
        )
      const fakeWBTCBalanceAfter = await fakeWBTC.balanceOf(
        await deployer.getAddress(),
      )
      expect(fakeWBTCBalanceAfter).to.be.eq(
        await ethers.utils.parseUnits("10000", await fakeWBTC.decimals()),
      )
    })
    it("should emit a Profit event", async () => {
      const amount = await ethers.utils.parseUnits(
        "10000",
        await fakeWBTC.decimals(),
      )
      await hegicStaking.connect(alice).buy(BN.from(1))
      await expect(hegicStaking.connect(alice).sendProfit(amount))
        .to.emit(hegicStaking, "Profit")
        .withArgs(amount)
    })
    it("should update totalProfit", async () => {
      const amount = await ethers.utils.parseUnits(
        "10000",
        await fakeWBTC.decimals(),
      )
      await hegicStaking.connect(alice).buy(BN.from(1))
      await hegicStaking.connect(bob).buy(BN.from(1))
      await hegicStaking.connect(alice).sendProfit(amount)
      expect(await hegicStaking.totalProfit()).to.be.eq(
        amount.mul(BN.from(10).pow(30)).div(2),
      )
    })
  })
})
