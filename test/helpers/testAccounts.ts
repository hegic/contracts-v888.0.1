import {Signer} from "ethers"

export interface Account {
  signer: Signer
  address: string
}

/**
 * @dev Test accounts
 */
export class TestAccounts {
  /**
   * @dev Default accounts as per system Migrations
   */
  public all!: Account[]

  public owner!: Account

  public user1!: Account

  public user2!: Account

  public user3!: Account

  public user4!: Account

  public user5!: Account

  public user6!: Account

  public user7!: Account

  public user8!: Account

  public user9!: Account

  public async initAccounts(signers: Signer[]): Promise<TestAccounts> {
    this.all = await Promise.all(
      signers.map(async (s) => ({
        signer: s,
        address: await s.getAddress(),
      })),
    )
    ;[
      this.owner,
      this.user1,
      this.user2,
      this.user3,
      this.user4,
      this.user5,
      this.user6,
      this.user7,
      this.user8,
      this.user9,
    ] = this.all
    return this
  }
}

export default TestAccounts
