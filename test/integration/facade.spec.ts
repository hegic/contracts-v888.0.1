import {ethers, deployments} from "hardhat"
import {BigNumber as BN, Signer} from "ethers"
import {solidity} from "ethereum-waffle"
import chai from "chai"
import {Facade} from "../../typechain/Facade"
import {HegicPool} from "../../typechain/HegicPool"
import {Erc20Mock as ERC20} from "../../typechain/Erc20Mock"

chai.use(solidity)
// const {expect} = chai
const ONE_DAY = BN.from(86400)
const optionType = {
  PUT: 1,
  CALL: 2,
}

describe("Facade", async () => {
  let facade: Facade
  let WBTC: ERC20
  let USDC: ERC20
  let alice: Signer
  let WBTCPool: HegicPool
  let USDCPool: HegicPool

  beforeEach(async () => {
    await deployments.fixture()
    ;[, alice] = await ethers.getSigners()

    // router = (await ethers.getContract("UniswapRouterMock")) as Uniswap
    facade = (await ethers.getContract("Facade")) as Facade
    WBTC = (await ethers.getContract("WBTC")) as ERC20
    USDC = (await ethers.getContract("USDC")) as ERC20
    USDCPool = (await ethers.getContract("HegicUSDCPool")) as HegicPool
    WBTCPool = (await ethers.getContract("HegicWBTCPool")) as HegicPool
    // hegicStakingWBTC = (await ethers.getContract("WBTCStaking")) as HegicStaking
    // hegicStakingUSDC = (await ethers.getContract("USDCStaking")) as HegicStaking
    // priceCalculator = (await ethers.getContract(
    //   "WBTCPriceCalculator",
    // )) as PriceCalculator
    // hegicOptions = (await ethers.getContract("WBTCOptions")) as HegicOptions
    // fakeHegic = (await ethers.getContract("HEGIC")) as Erc20Mock
    // fakeUSDC = (await ethers.getContract("USDC")) as Erc20Mock
    // WBTC = (await ethers.getContract("WBTC")) as Erc20Mock

    await WBTC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits("1000000", await WBTC.decimals()),
    )

    await WBTC.connect(alice).approve(
      WBTCPool.address,
      ethers.constants.MaxUint256,
    )

    await USDC.mintTo(
      await alice.getAddress(),
      ethers.utils.parseUnits("1000000", await USDC.decimals()),
    )

    await USDC.connect(alice).approve(
      USDCPool.address,
      ethers.constants.MaxUint256,
    )

    await WBTCPool.connect(alice).provideFrom(
      await alice.getAddress(),
      ethers.utils.parseUnits("100", 8),
      true,
      0,
    )

    await USDCPool.connect(alice).provideFrom(
      await alice.getAddress(),
      ethers.utils.parseUnits("1000000", 6),
      true,
      0,
    )
  })

  // let amount: BN
  // let strike: BN
  // let fees: Fees
  // let deployerWBTCBalanceBefore: BN
  // let deployerUSDCBalanceBefore: BN
  // let aliceWBTCBalanceBefore: BN
  // let aliceUSDCBalanceBefore: BN
  // let hegicPoolWBTCBalanceBefore: BN
  // let lockedAmountBefore: BN
  // let hedgePremium: BN
  // let hedgeFee: BN
  // let amountToLock: BN
  // let hegicStakingUSDCBalanceBefore: BN

  describe("Options", () => {
    it("should create Call option", async () => {
      await facade
        .connect(alice)
        .createOption(
          WBTC.address,
          ONE_DAY,
          ethers.utils.parseUnits("1", 8),
          0,
          optionType.CALL,
          {value: ethers.utils.parseUnits("1000")},
        )
    })
  })

  describe("Pool", () => {})
})
