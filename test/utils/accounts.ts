import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export type Accounts<N extends string> = { [K in N]: SignerWithAddress };
