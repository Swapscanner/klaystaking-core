import { ethers } from 'hardhat';
import { useSnapshot } from './utils/useSnapshot';
import { ERC20ProgrammaticBalanceMock } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import {
  AccountsConnectedContract,
  deployAccountsConnectedContract,
} from './utils/accountsConnectedContract';
import { makeEveryoneRich } from './utils/makeEveryoneRich';

export type AccountName = 'deployer' | 'alice' | 'bob' | 'carol';

const PRECISION_MULTIPLIER = 10n ** 27n;

describe('ERC20ProgrammaticBalance', () => {
  let token: AccountsConnectedContract<ERC20ProgrammaticBalanceMock, AccountName>;
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
      contract: 'ERC20ProgrammaticBalanceMock',
      args: [],
    });
  });

  describe('#_mintSharesForAmount', () => {
    it('should revert when minting to zero address', async () => {
      await expect(
        token.mintSharesAndAmount(ethers.constants.AddressZero, 100),
      ).to.be.revertedWithCustomError(token, 'TransferAddressZero');
    });

    it('should revert if computed share is too small', async () => {
      await token.mintSharesAndAmount(alice.address, 1n);
      await token.increaseTotalSupply(10n ** 60n);
      await expect(token.mintSharesAndAmount(alice.address, 1n)).to.be.revertedWithCustomError(
        token,
        'AmountTooSmall',
      );
    });
  });

  describe('when nothing has been minted', () => {
    describe('#sharesOf', () => {
      it('should return correct shares', async () => {
        expect(await token.sharesOf(alice.address)).to.equal(0n);
      });
    });

    describe('#totalShares', () => {
      it('should return correct total shares', async () => {
        expect(await token.totalShares()).to.equal(0n);
      });
    });

    describe('#totalSupply', () => {
      it('should return correct total supply', async () => {
        expect(await token.totalSupply()).to.equal(0n);
      });
    });

    describe('#balanceOf', () => {
      it('should return correct balance', async () => {
        expect(await token.balanceOf(alice.address)).to.equal(0n);
        expect(await token.balanceOf(bob.address)).to.equal(0n);
      });
    });

    describe('#votesCustomBalanceBalanceOf', () => {
      it('should return correct balance as shares', async () => {
        expect(await token.votesCustomBalanceBalanceOf(alice.address)).to.equal(0n);
        expect(await token.votesCustomBalanceBalanceOf(bob.address)).to.equal(0n);
      });
    });

    describe('#mint', () => {
      it('should revert', async () => {
        await expect(token.mint(alice.address, 100)).to.be.revertedWithCustomError(
          token,
          'NotAllowed',
        );
      });
    });

    describe('#burn', () => {
      it('should revert', async () => {
        await expect(token.burn(alice.address, 100)).to.be.revertedWithCustomError(
          token,
          'NotAllowed',
        );
      });
    });

    describe('when something has been minted', () => {
      useSnapshot(async () => {
        await token.mintSharesAndAmount(alice.address, 100);
        await token.mintSharesAndAmount(bob.address, 200);
      });

      describe('#sharesOf', () => {
        it('should return correct shares', async () => {
          expect(await token.sharesOf(alice.address)).to.equal(100n * PRECISION_MULTIPLIER);
          expect(await token.sharesOf(bob.address)).to.equal(200n * PRECISION_MULTIPLIER);
        });
      });

      describe('#totalShares', () => {
        it('should return correct total shares', async () => {
          expect(await token.totalShares()).to.equal(300n * PRECISION_MULTIPLIER);
        });
      });

      describe('#totalSupply', () => {
        it('should return correct total supply', async () => {
          expect(await token.totalSupply()).to.equal(300n);
        });
      });

      describe('#balanceOf', () => {
        it('should return correct balance', async () => {
          expect(await token.balanceOf(alice.address)).to.equal(100n);
          expect(await token.balanceOf(bob.address)).to.equal(200n);
        });
      });

      describe('#votesCustomBalanceBalanceOf', () => {
        it('should return correct balance as shares', async () => {
          expect(await token.votesCustomBalanceBalanceOf(alice.address)).to.equal(
            100n * PRECISION_MULTIPLIER,
          );
          expect(await token.votesCustomBalanceBalanceOf(bob.address)).to.equal(
            200n * PRECISION_MULTIPLIER,
          );
        });
      });

      describe('#_burnShares', () => {
        it('should revert when computed share is too small', async () => {
          await token.increaseTotalSupply(10n ** 60n);
          await expect(token.burnAmount(alice.address, 1n)).to.be.revertedWithCustomError(
            token,
            'AmountTooSmall',
          );
        });

        it('should revert when burning more than balance', async () => {
          await expect(token.burnAmount(alice.address, 101n)).to.be.revertedWithCustomError(
            token,
            'InsufficientBalance',
          );
        });
      });

      describe('#transfer', () => {
        it('should transfer entire shares when transferring entire balance', async () => {
          await token.for.alice.transfer(bob.address, 100n);
          expect(await token.sharesOf(alice.address)).to.equal(0n);
        });

        it('should revert when transferring more than balance', async () => {
          await expect(token.for.alice.transfer(bob.address, 101n)).to.be.revertedWithCustomError(
            token,
            'InsufficientBalance',
          );
        });

        it('should revert when transferring from zero address', async () => {
          await expect(
            token.forceTransfer(ethers.constants.AddressZero, alice.address, 100n),
          ).to.be.revertedWithCustomError(token, 'TransferAddressZero');
        });

        it('should revert when transferring to zero address', async () => {
          await expect(
            token.forceTransfer(alice.address, ethers.constants.AddressZero, 100n),
          ).to.be.revertedWithCustomError(token, 'TransferAddressZero');
        });
      });

      describe('when transferred', () => {
        useSnapshot(async () => {
          await token.for.bob.transfer(alice.address, 100n);
        });

        describe('#sharesOf', () => {
          it('should return correct shares', async () => {
            expect(await token.sharesOf(alice.address)).to.equal(200n * PRECISION_MULTIPLIER);
            expect(await token.sharesOf(bob.address)).to.equal(100n * PRECISION_MULTIPLIER);
          });
        });

        describe('#totalShares', () => {
          it('should return correct total shares', async () => {
            expect(await token.totalShares()).to.equal(300n * PRECISION_MULTIPLIER);
          });
        });

        describe('#totalSupply', () => {
          it('should return correct total supply', async () => {
            expect(await token.totalSupply()).to.equal(300n);
          });
        });

        describe('#balanceOf', () => {
          it('should return correct balance', async () => {
            expect(await token.balanceOf(alice.address)).to.equal(200n);
            expect(await token.balanceOf(bob.address)).to.equal(100n);
          });
        });

        describe('#votesCustomBalanceBalanceOf', () => {
          it('should return correct balance as shares', async () => {
            expect(await token.votesCustomBalanceBalanceOf(alice.address)).to.equal(
              200n * PRECISION_MULTIPLIER,
            );
            expect(await token.votesCustomBalanceBalanceOf(bob.address)).to.equal(
              100n * PRECISION_MULTIPLIER,
            );
          });
        });
      });

      describe('burning by shares', () => {
        useSnapshot(async () => {
          await token.burnShares(bob.address, 100n * PRECISION_MULTIPLIER);
        });

        describe('#sharesOf', () => {
          it('should return correct shares', async () => {
            expect(await token.sharesOf(alice.address)).to.equal(100n * PRECISION_MULTIPLIER);
            expect(await token.sharesOf(bob.address)).to.equal(100n * PRECISION_MULTIPLIER);
          });
        });

        describe('#totalShares', () => {
          it('should return correct total shares', async () => {
            expect(await token.totalShares()).to.equal(200n * PRECISION_MULTIPLIER);
          });
        });

        describe('#totalSupply', () => {
          it('should return correct total supply', async () => {
            expect(await token.totalSupply()).to.equal(200n);
          });
        });

        describe('#balanceOf', () => {
          it('should return correct balance', async () => {
            expect(await token.balanceOf(alice.address)).to.equal(100n);
            expect(await token.balanceOf(bob.address)).to.equal(100n);
          });
        });

        describe('#votesCustomBalanceBalanceOf', () => {
          it('should return correct balance as shares', async () => {
            expect(await token.votesCustomBalanceBalanceOf(alice.address)).to.equal(
              100n * PRECISION_MULTIPLIER,
            );
            expect(await token.votesCustomBalanceBalanceOf(bob.address)).to.equal(
              100n * PRECISION_MULTIPLIER,
            );
          });
        });
      });

      describe('burning by amount', () => {
        useSnapshot(async () => {
          await token.burnAmount(bob.address, 100n);
        });

        describe('#sharesOf', () => {
          it('should return correct shares', async () => {
            expect(await token.sharesOf(alice.address)).to.equal(100n * PRECISION_MULTIPLIER);
            expect(await token.sharesOf(bob.address)).to.equal(100n * PRECISION_MULTIPLIER);
          });
        });

        describe('#totalShares', () => {
          it('should return correct total shares', async () => {
            expect(await token.totalShares()).to.equal(200n * PRECISION_MULTIPLIER);
          });
        });

        describe('#totalSupply', () => {
          it('should return correct total supply', async () => {
            expect(await token.totalSupply()).to.equal(200n);
          });
        });

        describe('#balanceOf', () => {
          it('should return correct balance', async () => {
            expect(await token.balanceOf(alice.address)).to.equal(100n);
            expect(await token.balanceOf(bob.address)).to.equal(100n);
          });
        });

        describe('#votesCustomBalanceBalanceOf', () => {
          it('should return correct balance as shares', async () => {
            expect(await token.votesCustomBalanceBalanceOf(alice.address)).to.equal(
              100n * PRECISION_MULTIPLIER,
            );
            expect(await token.votesCustomBalanceBalanceOf(bob.address)).to.equal(
              100n * PRECISION_MULTIPLIER,
            );
          });
        });
      });
    });

    describe('when supply increased ahead of multiple mints', () => {
      useSnapshot(async () => {
        await token.increaseTotalSupply(200);
        await token.mintSharesForAmount(alice.address, 100, 0);
        await token.mintSharesForAmount(bob.address, 100, 100);
      });

      describe('#sharesOf', () => {
        it('should return correct shares', async () => {
          expect(await token.sharesOf(alice.address)).to.equal(100n * PRECISION_MULTIPLIER);
          expect(await token.sharesOf(bob.address)).to.equal(100n * PRECISION_MULTIPLIER);
        });
      });

      describe('#totalShares', () => {
        it('should return correct total shares', async () => {
          expect(await token.totalShares()).to.equal(200n * PRECISION_MULTIPLIER);
        });
      });

      describe('#totalSupply', () => {
        it('should return correct total supply', async () => {
          expect(await token.totalSupply()).to.equal(200n);
        });
      });

      describe('#balanceOf', () => {
        it('should return correct balance', async () => {
          expect(await token.balanceOf(alice.address)).to.equal(100n);
          expect(await token.balanceOf(bob.address)).to.equal(100n);
        });
      });

      describe('#votesCustomBalanceBalanceOf', () => {
        it('should return correct balance as shares', async () => {
          expect(await token.votesCustomBalanceBalanceOf(alice.address)).to.equal(
            100n * PRECISION_MULTIPLIER,
          );
          expect(await token.votesCustomBalanceBalanceOf(bob.address)).to.equal(
            100n * PRECISION_MULTIPLIER,
          );
        });
      });
    });
  });
});
