import {HardhatRuntimeEnvironment} from "hardhat/types"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const {deploy, get} = deployments
  const {deployer} = await getNamedAccounts()

  const WETH = await get("WETH")
  const WBTC = await get("WBTC")
  const USDC = await get("USDC")

  const WBTCPriceProvider = await get("WBTCPriceProvider")
  const ETHPriceProvider = await get("ETHPriceProvider")

  const x = await deploy("UniswapRouter", {
    from: deployer,
    contract: "UniswapRouterMock",
    args: [
      WBTC.address,
      USDC.address,
      WBTCPriceProvider.address,
      ETHPriceProvider.address,
    ],
  })

  await deploy("Facade", {
    from: deployer,
    args: [WETH.address, USDC.address, x.address],
  })
}

deployment.tags = ["test"]
export default deployment
