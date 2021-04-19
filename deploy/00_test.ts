import {HardhatRuntimeEnvironment} from "hardhat/types"

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const {deployer} = await getNamedAccounts()

  const HEGIC = await deploy("HEGIC", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["HEGIC", "H", 18],
  })

  const USDC = await deploy("USDC", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["USDC (Mock)", "USDC", 6],
  })

  const WETH = await deploy("WETH", {
    contract: "WETHMock",
    from: deployer,
    log: true,
  })

  const WBTC = await deploy("WBTC", {
    contract: "ERC20Mock",
    from: deployer,
    log: true,
    args: ["WBTC (Mock)", "WBTC", 8],
  })

  const WBTCPool = await deploy("HegicWBTCPool", {
    contract: "HegicPool",
    from: deployer,
    log: true,
    args: [WBTC.address, "writeWBTC", "wWBTC"],
  })

  const WETHPool = await deploy("HegicWETHPool", {
    contract: "HegicPool",
    from: deployer,
    log: true,
    args: [WETH.address, "writeWETH", "wWETH"],
  })

  const USDCPool = await deploy("HegicUSDCPool", {
    contract: "HegicPool",
    from: deployer,
    log: true,
    args: [USDC.address, "writeUSDC", "wUSDC"],
  })

  const WBTCPriceProvider = await deploy("WBTCPriceProvider", {
    contract: "PriceProviderMock",
    from: deployer,
    log: true,
    args: [50000e8],
  })

  const ETHPriceProvider = await deploy("ETHPriceProvider", {
    contract: "PriceProviderMock",
    from: deployer,
    log: true,
    args: [2500e8],
  })

  const WBTCPricer = await deploy("WBTCPriceCalculator", {
    contract: "PriceCalculator",
    from: deployer,
    log: true,
    args: [
      [9000, 10000, 20000],
      WBTCPriceProvider.address,
      WBTCPool.address,
      USDCPool.address,
      6,
    ],
  })

  const WETHPricer = await deploy("ETHPriceCalculator", {
    contract: "PriceCalculator",
    from: deployer,
    log: true,
    args: [
      [9000, 10000, 20000],
      ETHPriceProvider.address,
      WETHPool.address,
      USDCPool.address,
      6,
    ],
  })

  const WBTCStaking = await deploy("WBTCStaking", {
    contract: "HegicStaking",
    from: deployer,
    log: true,
    args: [HEGIC.address, WBTC.address, "WBTC Staking", "WBTC S"],
  })

  const WETHStaking = await deploy("WETHStaking", {
    contract: "HegicStaking",
    from: deployer,
    log: true,
    args: [HEGIC.address, WETH.address, "WBTC Staking", "WBTC S"],
  })

  const USDCStaking = await deploy("USDCStaking", {
    contract: "HegicStaking",
    from: deployer,
    log: true,
    args: [HEGIC.address, USDC.address, "USDC Staking", "USDC S"],
  })

  const WBTCOptions = await deploy("WBTCOptions", {
    contract: "HegicOptions",
    from: deployer,
    log: true,
    args: [
      WBTCPriceProvider.address,
      WBTCPricer.address,
      USDCPool.address,
      WBTCPool.address,
      USDCStaking.address,
      WBTCStaking.address,
      USDC.address,
      WBTC.address,
      "HegicOptions WBTC",
      "HO_WBTC",
    ],
  })

  const WETHOptions = await deploy("WETHOptions", {
    contract: "HegicOptions",
    from: deployer,
    log: true,
    args: [
      ETHPriceProvider.address,
      WETHPricer.address,
      USDCPool.address,
      WETHPool.address,
      USDCStaking.address,
      WETHStaking.address,
      USDC.address,
      WETH.address,
      "HegicOptions WETH",
      "HO_WETH",
    ],
  })

  await deploy("WBTCRewards", {
    contract: "HegicRewards",
    from: deployer,
    log: true,
    args: [
      WBTCOptions.address,
      HEGIC.address,
      "1000000000000000000000000",
      "1000000000",
      0,
    ],
  })

  await deploy("WETHRewards", {
    contract: "HegicRewards",
    from: deployer,
    log: true,
    args: [
      WETHOptions.address,
      HEGIC.address,
      "1000000000000000000000000",
      "0",
      0,
    ],
  })
}

deployment.tags = ["test"]
export default deployment
