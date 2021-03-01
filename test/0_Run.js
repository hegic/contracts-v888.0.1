const {expect} = require("chai")

const USDCPool = artifacts.require("USDCPool")
const USDC = artifacts.require("FakeUSDC")

contract("Options", (accounts) => {
  it("should put 10000 USDC in the first account", async () => {
    const USDCPoolInstance = await USDCPool.deployed()
    const USDCInstance = await USDC.deployed()
    await USDCInstance.approve(USDCPoolInstance.address, "10000000000")
    const res = await USDCPoolInstance.provideFrom(
      accounts[0],
      "10000000000",
      false,
      0
    )
    const {tokenId, to} = res.logs.find((x) => x.event == "Transfer").args
    const tranche = await USDCPoolInstance.tranches(tokenId)
    expect(tranche.amount.toString()).to.equal(
      "10000000000",
      "Wrong tranche amount"
    )
  })
})
