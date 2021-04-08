import {HardhatRuntimeEnvironment} from 'hardhat/types'
import {HegicPool} from "../typechain/HegicPool"
import {HegicOptions} from "../typechain/HegicOptions"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {ethers} = hre;

  const USDCPool = await ethers.getContract("HegicUSDCPool") as HegicPool
  const WBTCPool = await ethers.getContract("HegicWBTCPool") as HegicPool
  const WBTCOptions = (await ethers.getContract("WBTCOptions")) as HegicOptions
  await USDCPool.grantRole(await USDCPool.HEGIC_OPTIONS_ROLE(), WBTCOptions.address)
  await WBTCPool.grantRole(await WBTCPool.HEGIC_OPTIONS_ROLE(), WBTCOptions.address)
};

deployment.tags = ['test']
export default deployment;
