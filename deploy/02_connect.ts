import {HardhatRuntimeEnvironment} from "hardhat/types"
import {HegicPool} from "../typechain/HegicPool"
import {HegicOptions} from "../typechain/HegicOptions"
import {WethMock} from "../typechain/WethMock"
import {Erc20Mock} from "../typechain/Erc20Mock"
import {Facade} from "../typechain/Facade"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {ethers} = hre

  const WETH = (await ethers.getContract("WETH")) as WethMock
  const WBTC = (await ethers.getContract("WBTC")) as Erc20Mock
  const facade = (await ethers.getContract("Facade")) as Facade
  const USDCPool = (await ethers.getContract("HegicUSDCPool")) as HegicPool
  const WBTCPool = (await ethers.getContract("HegicWBTCPool")) as HegicPool
  const WETHPool = (await ethers.getContract("HegicWETHPool")) as HegicPool
  const WBTCOptions = (await ethers.getContract("WBTCOptions")) as HegicOptions
  const WETHOptions = (await ethers.getContract("WETHOptions")) as HegicOptions

  await USDCPool.grantRole(
    await USDCPool.HEGIC_OPTIONS_ROLE(),
    WBTCOptions.address,
  )
  await USDCPool.grantRole(
    await USDCPool.HEGIC_OPTIONS_ROLE(),
    WETHOptions.address,
  )
  await WBTCPool.grantRole(
    await WBTCPool.HEGIC_OPTIONS_ROLE(),
    WBTCOptions.address,
  )
  await WETHPool.grantRole(
    await WETHPool.HEGIC_OPTIONS_ROLE(),
    WETHOptions.address,
  )

  await WETH.deposit({
    value: ethers.utils.parseUnits("1000"),
  })
  await facade.appendHegicOptions(WBTC.address, WBTCOptions.address)
  await facade.appendHegicOptions(WETH.address, WETHOptions.address)
}

deployment.tags = ["test"]
export default deployment
