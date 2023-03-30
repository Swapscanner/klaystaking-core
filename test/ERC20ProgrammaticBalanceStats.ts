import { ethers } from 'hardhat';
import { useSnapshot } from './utils/useSnapshot';
import { ERC20ProgrammaticBalanceStatsMock } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import {
  AccountsConnectedContract,
  deployAccountsConnectedContract,
} from './utils/accountsConnectedContract';
import { makeEveryoneRich } from './utils/makeEveryoneRich';

export type AccountName = 'deployer' | 'alice' | 'bob' | 'carol';

const PRECISION_MULTIPLIER = 10n ** 27n;

describe('ERC20ProgrammaticBalanceStats', () => {
  let token: AccountsConnectedContract<ERC20ProgrammaticBalanceStatsMock, AccountName>;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let misc: SignerWithAddress;

  useSnapshot(async () => {
    await makeEveryoneRich();

    [deployer, alice, bob, carol, misc] = await ethers.getSigners();
    const accounts = { deployer, alice, bob, carol };
    token = await deployAccountsConnectedContract({
      accounts,
      defaultAccount: misc,
      contract: 'ERC20ProgrammaticBalanceStatsMock',
      args: [],
    });
  });

  describe('#emitStats', () => {
    it('should emit correctly', async () => {
      await expect(token.emitStats()).to.emit(token, 'Stats').withArgs(0n, 0n);
    });

    it('should emit correctly with non-zero shares and supply', async () => {
      await token.mintSharesAndAmount(alice.address, 100n);
      await token.mintSharesAndAmount(bob.address, 200n);
      await token.mintSharesAndAmount(carol.address, 300n);
      await expect(token.emitStats())
        .to.emit(token, 'Stats')
        .withArgs(600n * PRECISION_MULTIPLIER, 600n);

      await token.increaseTotalSupply(100n);
      await expect(token.emitStats())
        .to.emit(token, 'Stats')
        .withArgs(600n * PRECISION_MULTIPLIER, 700n);
    });
  });
});
