import {HardhatRuntimeEnvironment} from 'hardhat/types';

async function deployment(hre: HardhatRuntimeEnvironment): Promise<void> {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  const USDC = await deploy('USDC', {
    contract: 'ERC20Mock',
    from: deployer,
    log: true,
    args: ["USDC (Mock)", "USDC", 6],
  })

  const WBTC = await deploy('WBTC', {
    contract: 'ERC20Mock',
    from: deployer,
    log: true,
    args: ["WBTC (Mock)", "WBTC", 8],
  })

  const WBTCPool = await deploy('HegicWBTCPool', {
    contract: 'HegicPool',
    from: deployer,
    log: true,
    args: [WBTC.address, "writeWBTC", 'wWBTC'],
  })

  const USDCPool = await deploy('HegicUSDCPool', {
    contract: 'HegicPool',
    from: deployer,
    log: true,
    args: [USDC.address, "writeUSDC", 'wUSDC'],
  })

  const WBTCPriceProvider = await deploy('WBTCPriceProvider', {
    contract: 'PriceProviderMock',
    from: deployer,
    log: true,
    args: [50000],
  })

  await deploy('WBTCPriceCalculator', {
    contract: 'PriceCalculator',
    from: deployer,
    log: true,
    args: [
      [9000, 10000, 20000],
      WBTCPriceProvider.address,
      WBTCPool.address,
      6,
    ],
  })

  const HEGIC = await deploy('HEGIC', {
    contract: 'ERC20Mock',
    from: deployer,
    log: true,
    args: ["HEGIC", "H", 18],
  })

  const WBTCStaking = await deploy('WBTCStaking', {
    contract: 'HegicStaking',
    from: deployer,
    log: true,
    args: [HEGIC.address, WBTC.address, "WBTC Staking", "WBTC S"],
  })

  const USDCStaking = await deploy('USDCStaking', {
    contract: 'HegicStaking',
    from: deployer,
    log: true,
    args: [HEGIC.address, USDC.address, "USDC Staking", "USDC S"],
  })


  const WBTCOptions = await deploy('WBTCOptions', {
    contract: 'HegicOptions',
    from: deployer,
    log: true,
    args: [
      WBTCPriceProvider.address,
      WBTCPool.address,
      USDCPool.address,
      USDCStaking.address,
      WBTCStaking.address,
      WBTC.address,
      USDC.address,
      "HegicOptions WBTC",
      "HO_WBTC"
    ],
  })

  await deploy('WBTCRewards', {
    contract: 'HegicRewards',
    from: deployer,
    log: true,
    args: [WBTCOptions.address, HEGIC.address, "1000000000000000000000000", "1000000000", 0],
  })

};

deployment.tags = ['test']
export default deployment;
