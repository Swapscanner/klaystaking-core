import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { CNStakedKLAYTest, CnStakingV2, ProxyStakedKLAYClaimCheck } from '../typechain-types';
import { useSnapshot } from './utils/useSnapshot';
import { useLogger } from './utils/useLogger';
import { BigNumber, BigNumberish } from 'ethers';
import { TransactionResponse } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expectEtherBalanceOf } from './utils/balanceAssertions';
import { Accounts } from './utils/accounts';
import {
  AccountsConnectedContract,
  deployAccountsConnectedContract,
} from './utils/accountsConnectedContract';
import { createClaimCheck } from './utils/claimCheck';

type AccountName = 'deployer' | 'alice' | 'bob' | 'carol' | 'foundationAdmin' | 'cnAdmin' | 'feeTo';
type StateAssertion = (account: string | { address: string }) => Chai.PromisedAssertion;

const ETHER = 10n ** 18n;

describe('CNStakedKLAY', () => {
  let allAccounts: SignerWithAddress[];
  let accounts: Accounts<AccountName>;

  let cnStaking: CnStakingV2;
  let cnStakedKLAY: AccountsConnectedContract<CNStakedKLAYTest, AccountName>;
  let claimCheck: AccountsConnectedContract<ProxyStakedKLAYClaimCheck, AccountName>;

  let issueReward: (amount: BigNumberish) => Promise<TransactionResponse>;

  let expectBalanceOf: StateAssertion;
  let expectSharesOf: StateAssertion;

  let printStats: (msg: string) => Promise<void>;

  const log = useLogger();

  useSnapshot(async () => {
    allAccounts = await ethers.getSigners();

    // let's make everyone rich
    for (const account of allAccounts) {
      await ethers.provider.send('hardhat_setBalance', [
        account.address,
        '0x' + (0x1c9c380000000n * ETHER).toString(16),
      ]);
    }

    const [deployer, foundationAdmin, cnAdmin, feeTo, misc, alice, bob, carol] = allAccounts;
    accounts = { deployer, foundationAdmin, cnAdmin, feeTo, alice, bob, carol };

    // deploy contracts
    const CnStakingV2 = await ethers.getContractFactory('CnStakingV2');
    cnStaking = await CnStakingV2.deploy(
      foundationAdmin.address,
      foundationAdmin.address,
      foundationAdmin.address,
      [cnAdmin.address],
      1,
      [Math.floor(Date.now() / 1000) + 10],
      [1],
      // { gasLimit: "0x1c9c380000000" }
    );
    await cnStaking.connect(foundationAdmin).setGCId(1);
    // await cnStaking.setStakingTracker(cnStaking.address, { from: accounts[1] });
    await cnStaking.connect(foundationAdmin).reviewInitialConditions();
    await cnStaking.connect(cnAdmin).reviewInitialConditions();
    await cnStaking.depositLockupStakingAndInit({ value: '1' });

    // deploy contracts
    cnStakedKLAY = await deployAccountsConnectedContract<CNStakedKLAYTest, AccountName>({
      accounts,
      defaultAccount: misc,
      contract: 'CNStakedKLAYTest',
      args: [feeTo.address, cnStaking.address],
    });
    await cnStakedKLAY.deployed();

    const ProxyStakedKLAYClaimCheckSVGUtils = await ethers.getContractFactory(
      'ProxyStakedKLAYClaimCheckSVGUtils',
    );
    const proxyStakedKLAYClaimCheckSVGUtils = await ProxyStakedKLAYClaimCheckSVGUtils.deploy();
    await proxyStakedKLAYClaimCheckSVGUtils.deployed();

    claimCheck = await deployAccountsConnectedContract<ProxyStakedKLAYClaimCheck, AccountName>({
      accounts,
      defaultAccount: misc,
      contract: 'ProxyStakedKLAYClaimCheck',
      factoryOptions: {
        libraries: { ProxyStakedKLAYClaimCheckSVGUtils: proxyStakedKLAYClaimCheckSVGUtils.address },
      },
      args: [cnStakedKLAY.address, 'Consensus Node Staked'],
    });

    // configure contracts
    await cnStakedKLAY.for.deployer.setClaimCheck(claimCheck.address);
    await cnStaking.connect(cnAdmin).submitAddAdmin(cnStakedKLAY.address);

    issueReward = (amount: BigNumberish) =>
      misc.sendTransaction({
        to: cnStakedKLAY.address,
        value: amount,
      });

    expectBalanceOf = (account: string | { address: string }) =>
      expect(cnStakedKLAY.balanceOf(typeof account === 'string' ? account : account.address))
        .eventually;

    expectSharesOf = (account: string | { address: string }) =>
      expect(cnStakedKLAY.sharesOf(typeof account === 'string' ? account : account.address))
        .eventually;

    printStats = async (title = '') => {
      const stats = {
        accounts: await Promise.all(
          Object.entries(accounts).map(async ([name, { address }]) => ({
            name,
            address,
            shares: await cnStakedKLAY.sharesOf(address),
            balance: await cnStakedKLAY.balanceOf(address),
          })),
        ).then((a) => a.filter((a) => !a.shares.isZero() || !a.balance.isZero())),
        totalShares: await cnStakedKLAY.totalShares(),
        totalSupply: await cnStakedKLAY.totalSupply(),
      };
      log(`## ${title} - cnStakedKLAY STATS`);
      log(stats);
      log(`## ${title} - cnStakedKLAY STATS END`);
    };
  });

  describe('cnStakedKLAY', () => {
    describe('ERC20VotesCustomBalance', () => {
      describe('stake before delegate', () => {
        useSnapshot(async () => {
          await cnStakedKLAY.for.alice.stake({ value: ETHER });
        });

        it('should have zero votes', async () => {
          const aliceVotes = await cnStakedKLAY.getVotes(accounts.alice.address);

          expect(aliceVotes).to.not.equal(await cnStakedKLAY.sharesOf(accounts.alice.address));

          expect(aliceVotes).to.equal(0n);
        });

        describe('after delegate', () => {
          useSnapshot(async () => {
            await cnStakedKLAY.for.alice.delegate(accounts.alice.address);
          });

          it('should have correct votes', async () => {
            expect(await cnStakedKLAY.getVotes(accounts.alice.address)).to.equal(
              await cnStakedKLAY.sharesOf(accounts.alice.address),
            );
          });

          it('should have correct votes after "stake"', async () => {
            await cnStakedKLAY.for.alice.stake({ value: ETHER });

            expect(await cnStakedKLAY.getVotes(accounts.alice.address)).to.equal(
              await cnStakedKLAY.sharesOf(accounts.alice.address),
            );
          });
        });
      });

      describe('delegate and then stake', () => {
        useSnapshot(async () => {
          await cnStakedKLAY.for.alice.delegate(accounts.alice.address);
          await cnStakedKLAY.for.alice.stake({ value: ETHER });
        });

        it('should keep track of shares and totalShares at specific block', async () => {
          const expectedTotalSupply = await cnStakedKLAY.totalShares();
          const expectedVotes = await cnStakedKLAY.sharesOf(accounts.alice.address);
          const expectedVotesAt = await time.latestBlock();

          await cnStakedKLAY.for.alice.stake({ value: ETHER });
          await cnStakedKLAY.for.alice.stake({ value: ETHER });
          await cnStakedKLAY.for.alice.stake({ value: ETHER });

          expect(await cnStakedKLAY.getPastTotalSupply(expectedVotesAt)).to.equal(
            expectedTotalSupply,
          );

          expect(await cnStakedKLAY.getPastVotes(accounts.alice.address, expectedVotesAt)).to.equal(
            expectedVotes,
          );

          expect(await cnStakedKLAY.getVotes(accounts.alice.address)).to.equal(
            await cnStakedKLAY.sharesOf(accounts.alice.address),
          );
        });
      });
    });

    describe('token transfers', () => {
      describe('when fee is zero', () => {
        useSnapshot(async () => {
          await issueReward(ETHER); // this should go to feeTo
          await cnStakedKLAY.for.alice.stake({ value: ETHER }); // this should go to alice
          await issueReward(ETHER); // this should go to feeTo and alice
          await cnStakedKLAY.for.bob.stake({ value: ETHER }); // this should go to bob
          await issueReward(ETHER); // this should go to feeTo, alice and bob
          // intentionally leaving some amount not sweeped

          await expectEtherBalanceOf(cnStakedKLAY).to.equal(ETHER);
          await expectEtherBalanceOf(cnStaking).to.equal(4n * ETHER + 1n);
        });

        describe('#transfer()', () => {
          it('should sweep on transfer', async () => {
            await printStats('before transfer');

            await cnStakedKLAY.for.alice.transfer(accounts.bob.address, ETHER);

            await expectEtherBalanceOf(cnStakedKLAY).to.equal(0n);
            await expectEtherBalanceOf(cnStaking).to.equal(5n * ETHER + 1n);

            await printStats('after transfer');
          });

          it('should transfer entire amount', async () => {
            const amount = await cnStakedKLAY.balanceOf(accounts.alice.address);

            await expect(
              cnStakedKLAY.for.alice.transfer(accounts.carol.address, amount),
            ).to.changeTokenBalances(
              cnStakedKLAY,
              [accounts.alice, accounts.carol],
              [BigNumber.from(0).sub(amount), amount],
            );

            await expectSharesOf(accounts.alice).to.equal(0n);
            await expectBalanceOf(accounts.alice).to.equal(0n);
            await expectBalanceOf(accounts.carol).to.equal(amount);
          });

          it('should revert on insufficient balance', async () => {
            await expect(
              cnStakedKLAY.for.alice.transfer(accounts.bob.address, 4n * ETHER),
            ).to.be.revertedWithCustomError(cnStakedKLAY, 'InsufficientBalance');
          });
        });

        describe('#transferFrom()', () => {
          useSnapshot(async () => {
            await cnStakedKLAY.for.alice.approve(accounts.bob.address, 100n * ETHER);
          });

          it('should revert on insufficient allowance', async () => {
            await expect(
              cnStakedKLAY.for.carol.transferFrom(
                accounts.alice.address,
                accounts.bob.address,
                1n * ETHER,
              ),
            ).to.be.revertedWith('ERC20: insufficient allowance');
          });

          it('should revert on insufficient balance', async () => {
            await expect(
              cnStakedKLAY.for.bob.transferFrom(
                accounts.alice.address,
                accounts.bob.address,
                (await cnStakedKLAY.balanceOf(accounts.alice.address)).add(ETHER),
              ),
            ).to.be.revertedWithCustomError(cnStakedKLAY, 'InsufficientBalance');
          });
        });
      });

      describe('when fee is ten percent', () => {
        useSnapshot(async () => {
          await cnStakedKLAY.for.deployer.setFee(accounts.feeTo.address, 10, 100);

          await issueReward(ETHER); // this should go to feeTo
          await cnStakedKLAY.for.alice.stake({ value: ETHER }); // this should go to alice
          await issueReward(ETHER); // this should go to feeTo 0.9/2 + (0.1) and alice 0.9/2
          // leaving some amount not sweeped
        });

        describe('#transfer()', () => {
          it('should sweep on transfer', async () => {
            await printStats('before transfer');

            expect(await cnStakedKLAY.totalSupply()).to.equal(290n * 10n ** 16n);

            await expectEtherBalanceOf(cnStakedKLAY).to.equal(ETHER);
            await expectBalanceOf(accounts.feeTo).to.eventually.equal(145n * 10n ** 16n);
            await expectBalanceOf(accounts.alice).to.eventually.equal(145n * 10n ** 16n);
            await expectEtherBalanceOf(cnStaking).to.equal(2n * ETHER + 1n);

            await cnStakedKLAY.for.alice.transfer(accounts.bob.address, ETHER.toString());

            await expectEtherBalanceOf(cnStakedKLAY).to.equal(0n);
            await expectEtherBalanceOf(cnStaking).to.equal(3n * ETHER + 1n);
            await expectBalanceOf(accounts.feeTo).to.equal(155n * 10n ** 16n - 1n); // `-1n` is due to the precision loss
            await expectBalanceOf(accounts.alice).to.equal((45n * 10n ** 16n).toString());

            await printStats('after transfer');
          });
        });
      });
    });

    describe('#totalSupply()', () => {
      it('should return correct amount', async () => {
        expect(await cnStakedKLAY.totalSupply()).to.equal(0n);
      });
    });

    describe('when some reward is there without stakers', () => {
      useSnapshot(async () => {
        await issueReward(ETHER);
      });

      describe('#totalSupply()', () => {
        it('should return correct amount', async () => {
          expect(await cnStakedKLAY.totalSupply()).to.equal(0n);
        });
      });

      describe('#sweep()', () => {
        useSnapshot(async () => {
          await printStats('before sweep');
          await cnStakedKLAY.for.alice.sweep();
          await printStats('after sweep');
        });

        it('should collect all the reward as fee', async () => {
          await expectBalanceOf(accounts.feeTo).to.equal(ETHER);
        });
      });
    });

    describe('#setFee()', () => {
      it('should revert on non-admin call', async () => {
        await expect(
          cnStakedKLAY.for.alice.setFee(accounts.feeTo.address, 1, 100),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should revert on too high fee', async () => {
        await expect(
          cnStakedKLAY.for.deployer.setFee(accounts.feeTo.address, 30, 100),
        ).to.be.revertedWithCustomError(cnStakedKLAY, 'ExcessiveFee');
      });

      it('should revert on zero address with fee', async () => {
        await expect(
          cnStakedKLAY.for.deployer.setFee(ethers.constants.AddressZero, 10, 100),
        ).to.be.revertedWithCustomError(cnStakedKLAY, 'UndefinedFeeTo');
      });

      it('should update fee', async () => {
        await cnStakedKLAY.for.deployer.setFee(accounts.feeTo.address, 2, 1000);
        expect(await cnStakedKLAY.feeTo()).to.equal(accounts.feeTo.address);
        expect(await cnStakedKLAY.feeNumerator()).to.equal(2);
        expect(await cnStakedKLAY.feeDenominator()).to.equal(1000);
      });

      it('should be able to neutralize fee', async () => {
        await cnStakedKLAY.for.deployer.setFee(ethers.constants.AddressZero, 0, 1000);
        expect(await cnStakedKLAY.feeTo()).to.equal(ethers.constants.AddressZero);
        expect(await cnStakedKLAY.feeNumerator()).to.equal(0);
        expect(await cnStakedKLAY.feeDenominator()).to.equal(1000);
      });

      it('should be able to collect fee only from rewards for unstaking amounts', async () => {
        await cnStakedKLAY.for.deployer.setFee(accounts.alice.address, 0, 1000);
        expect(await cnStakedKLAY.feeTo()).to.equal(accounts.alice.address);
        expect(await cnStakedKLAY.feeNumerator()).to.equal(0);
        expect(await cnStakedKLAY.feeDenominator()).to.equal(1000);
      });
    });

    describe('#stake()', () => {
      it('should able to stake 0 klay (this is equivalent sweep balances)', async () => {
        await cnStakedKLAY.for.alice.stake({ value: 0n });
      });
    });

    describe('#stakeFor()', () => {
      it('should be able to stake for other account', async () => {
        await expect(
          cnStakedKLAY.for.bob.stakeFor(accounts.alice.address, { value: ETHER }),
        ).to.changeTokenBalances(
          cnStakedKLAY,
          [accounts.alice.address, accounts.bob.address],
          [ETHER, 0n],
        );
      });
    });

    describe('when alice staked', () => {
      useSnapshot(async () => {
        await cnStakedKLAY.for.alice.stake({ value: ETHER });
      });

      it('should have correct balance', async () => {
        await expectBalanceOf(accounts.alice).to.equal(ETHER);
      });

      it('should have correct total supply', async () => {
        expect(await cnStakedKLAY.totalSupply()).to.equal(10n ** 18n);
      });

      it('should have correct total shares', async () => {
        expect(await cnStakedKLAY.totalShares()).to.equal(10n ** 18n);
      });

      describe('and reward issued and fee is zero', () => {
        useSnapshot(async () => {
          await issueReward(ETHER);
        });

        it('should have correct balance', async () => {
          await expectBalanceOf(accounts.alice).to.equal(2n * ETHER);
        });

        it('should be able to unstake', async () => {
          await cnStakedKLAY.for.alice.unstake(2n * ETHER);
        });

        it('should not be able to unstake more than balance', async () => {
          await expect(cnStakedKLAY.for.alice.unstake(3n * ETHER)).to.be.revertedWithCustomError(
            cnStakedKLAY,
            'InsufficientBalance',
          );
        });
      });

      describe('and reward issued and fee is 10%', () => {
        useSnapshot(async () => {
          await cnStakedKLAY.for.deployer.setFee(accounts.feeTo.address, 10, 100);
          await issueReward(ETHER);
        });

        describe('before sweep', () => {
          it('should have correct balance', async () => {
            await expectBalanceOf(accounts.alice).to.equal(19n * 10n ** 17n);
          });

          it('should be able to unstake', async () => {
            await cnStakedKLAY.for.alice.unstake(19n * 10n ** 17n);
            await expectBalanceOf(accounts.alice).to.equal(0n);
          });

          it('should not be able to unstake more than balance', async () => {
            await expect(
              cnStakedKLAY.for.alice.unstake(3n * 10n ** 18n),
            ).to.be.revertedWithCustomError(cnStakedKLAY, 'InsufficientBalance');
          });

          it('should have correct total supply', async () => {
            const totalSupply = await cnStakedKLAY.totalSupply();
            const balance0 = await cnStakedKLAY.balanceOf(accounts.alice.address);
            const balanceFeeTo = await cnStakedKLAY.balanceOf(accounts.feeTo.address);

            log({ totalSupply, balance0, balanceFeeTo });

            expect(totalSupply).to.equal(balance0.add(balanceFeeTo));
          });
        });

        describe('after sweep', () => {
          useSnapshot(async () => {
            await printStats('before sweep');
            await cnStakedKLAY.sweep();
            await printStats('after sweep');
          });

          it('should collect correct reward', async () => {
            await expectBalanceOf(accounts.feeTo).to.equal(1n * 10n ** 17n - 1n);
          });

          it('should have correct balance', async () => {
            await expectBalanceOf(accounts.alice).to.equal(19n * 10n ** 17n);
          });

          it('should be able to unstake', async () => {
            // NOTE: -1 is due to rounding error
            await cnStakedKLAY.for.feeTo.unstake(1n * 10n ** 17n - 1n);
            await expectBalanceOf(accounts.feeTo).to.equal(0n);

            // NOTE: +1 is due to rounding error
            await expectBalanceOf(accounts.alice).to.equal(19n * 10n ** 17n + 1n);
            await cnStakedKLAY.for.alice.unstake(19n * 10n ** 17n + 1n);
            await expectBalanceOf(accounts.alice).to.equal(0n);
          });

          it('should not be able to unstake more than balance', async () => {
            await expect(
              cnStakedKLAY.for.alice.unstake(3n * 10n ** 18n),
            ).to.be.revertedWithCustomError(cnStakedKLAY, 'InsufficientBalance');
          });
        });
      });

      describe('#unstake()', () => {
        it('should not be able to unstake 0', async () => {
          await expect(cnStakedKLAY.for.alice.unstake(0n)).to.be.revertedWithCustomError(
            cnStakedKLAY,
            'AmountTooSmall',
          );
        });

        it('should not be able to unstake more than balance', async () => {
          await expect(
            cnStakedKLAY.for.alice.unstake(11n * 10n ** 18n),
          ).to.be.revertedWithCustomError(cnStakedKLAY, 'InsufficientBalance');
        });

        it('should unstake and issue valid claim check', async () => {
          expect(await claimCheck.balanceOf(accounts.alice.address)).to.equal(0n);

          await cnStakedKLAY.for.alice.unstake(ETHER);
          await expectBalanceOf(accounts.alice).to.equal(0n);

          expect(await claimCheck.balanceOf(accounts.alice.address)).to.equal('1');
          expect(await claimCheck.tokenOfOwnerByIndex(accounts.alice.address, 0)).to.equal('0');

          const { withdrawableFrom } = await cnStaking.getApprovedStakingWithdrawalInfo('0');

          const amountString = '1';

          const actual = JSON.parse(
            Buffer.from((await claimCheck.tokenURI('0')).slice(28), 'base64').toString(),
          );

          actual.image = Buffer.from(actual.image.slice(26), 'base64').toString();

          const expected = createClaimCheck({
            tokenId: '0',
            withdrawableFrom,
            amountString,
            status: 'pending',
          });

          expect(actual).to.deep.equal(expected);
        });

        it('should issue pending claim check with correct amount string', async () => {
          await cnStakedKLAY.for.alice.stake({ value: 2000n * ETHER });

          await cnStakedKLAY.for.alice.unstake(1234n * ETHER + 123n);

          const { withdrawableFrom } = await cnStaking.getApprovedStakingWithdrawalInfo('0');
          const amountString = '1,234.000000000000000123';

          const actual = JSON.parse(
            Buffer.from((await claimCheck.tokenURI('0')).slice(28), 'base64').toString(),
          );

          actual.image = Buffer.from(actual.image.slice(26), 'base64').toString();

          const expected = createClaimCheck({
            tokenId: '0',
            withdrawableFrom,
            amountString,
            status: 'pending',
          });

          expect(actual).to.deep.equal(expected);
        });

        it('should not be able to claim before withdrawableFrom', async () => {
          await cnStakedKLAY.for.alice.unstake(10n ** 18n);

          await expect(cnStakedKLAY.for.alice.claim('0')).to.be.revertedWith(
            'Not withdrawable yet.',
          );
        });

        it('should be able to claim after withdrawableFrom', async () => {
          await cnStakedKLAY.for.alice.unstake(10n ** 18n);

          await time.increase(86400 * 7 + 1);

          await claimCheck.for.alice.approve(accounts.bob.address, '0');

          await expect(cnStakedKLAY.for.bob.claim('0')).to.changeEtherBalance(
            accounts.alice.address,
            ETHER,
          );

          // check if claim check is burned
          expect(await claimCheck.balanceOf(accounts.alice.address)).to.equal(0n);
          expect(await claimCheck.totalSupply()).to.equal(0n);
        });
      });

      describe('#unstakeAll()', () => {
        it('should unstake all balances', async () => {
          await cnStakedKLAY.for.alice.unstakeAll();

          await expectBalanceOf(accounts.alice).to.equal(0n);
        });

        it('should not be able to unstake all if balance is zero', async () => {
          await expect(cnStakedKLAY.for.bob.unstakeAll()).to.be.revertedWithCustomError(
            cnStakedKLAY,
            'AmountTooSmall',
          );
        });

        it('should sweep rewards', async () => {
          await issueReward(ETHER);

          await cnStakedKLAY.for.alice.unstakeAll();

          await expectEtherBalanceOf(cnStakedKLAY).to.equal(0n);
          await expectBalanceOf(accounts.alice).to.equal(0n);
        });
      });

      describe('with unstaking request in place', () => {
        useSnapshot(async () => {
          await cnStakedKLAY.for.alice.unstake(10n ** 18n);
        });

        describe('#cancel()', () => {
          it('should deny cancellation from other account', async () => {
            await expect(cnStakedKLAY.for.bob.cancel('0')).to.be.revertedWithCustomError(
              cnStakedKLAY,
              'PermissionDenied',
            );
          });

          it('should cancel withdrawal request', async () => {
            await expect(cnStakedKLAY.for.alice.cancel('0'))
              .to.changeTokenBalance(cnStakedKLAY, accounts.alice, ETHER)
              .and.changeTokenBalance(claimCheck, accounts.alice, -1n);
          });
        });

        describe('#claim()', () => {
          describe('during lockup', () => {
            it('should not be able to claim', async () => {
              await expect(cnStakedKLAY.for.alice.claim('0')).to.be.revertedWith(
                'Not withdrawable yet.',
              );
            });
          });

          describe('after lockup, before expiry', () => {
            useSnapshot(async () => {
              await time.increase(86400 * 7 + 1);
            });

            it('should issue valid `valid` claim check with correct amount string', async () => {
              const { withdrawableFrom } = await cnStaking.getApprovedStakingWithdrawalInfo('0');

              const amountString = '1';

              const actual = JSON.parse(
                Buffer.from((await claimCheck.tokenURI('0')).slice(28), 'base64').toString(),
              );

              actual.image = Buffer.from(actual.image.slice(26), 'base64').toString();

              const expected = createClaimCheck({
                tokenId: '0',
                withdrawableFrom,
                amountString,
                status: 'valid',
              });

              expect(actual).to.deep.equal(expected);
            });

            it('should not be able to claim by other account', async () => {
              await expect(cnStakedKLAY.for.bob.claim('0')).to.be.revertedWithCustomError(
                cnStakedKLAY,
                'PermissionDenied',
              );
            });

            it('should be able to claim', async () => {
              await claimCheck.for.alice.approve(accounts.bob.address, '0');
              await expect(cnStakedKLAY.for.alice.claim('0')).to.changeEtherBalances(
                [cnStaking.address, accounts.alice.address],
                [-ETHER, ETHER],
              );
            });

            it('should issue valid `claimed` claim check with correct amount string', async () => {
              await claimCheck.for.alice.approve(accounts.bob.address, '0');
              await cnStakedKLAY.for.alice.claim('0');

              const { withdrawableFrom } = await cnStaking.getApprovedStakingWithdrawalInfo('0');

              const amountString = '1';

              const actual = JSON.parse(
                Buffer.from((await claimCheck.tokenURI('0')).slice(28), 'base64').toString(),
              );

              actual.image = Buffer.from(actual.image.slice(26), 'base64').toString();

              const expected = createClaimCheck({
                tokenId: '0',
                withdrawableFrom,
                amountString,
                status: 'claimed',
              });

              expect(actual).to.deep.equal(expected);
            });

            it('should be able to claim by another owner', async () => {
              await claimCheck.for.alice['safeTransferFrom(address,address,uint256)'](
                accounts.alice.address,
                accounts.bob.address,
                '0',
              );
              await claimCheck.for.bob.approve(accounts.carol.address, '0');
              await expect(cnStakedKLAY.for.carol.claim('0')).to.changeEtherBalances(
                [cnStaking.address, accounts.alice.address, accounts.bob.address],
                [-ETHER, 0n, ETHER],
              );
            });

            it('should sweep rewards on claim', async () => {
              await issueReward(ETHER);
              await expectEtherBalanceOf(cnStakedKLAY.address).to.equal(ETHER);
              await cnStakedKLAY.for.alice.claim('0');
              await expectEtherBalanceOf(cnStakedKLAY.address).to.equal(0n);
            });
          });

          describe('after expiry', () => {
            useSnapshot(async () => {
              await time.increase(86400 * 14 + 1);
            });

            it('should issue valid `expired` claim check with correct amount string', async () => {
              const { withdrawableFrom } = await cnStaking.getApprovedStakingWithdrawalInfo('0');

              const amountString = '1';

              const actual = JSON.parse(
                Buffer.from((await claimCheck.tokenURI('0')).slice(28), 'base64').toString(),
              );

              actual.image = Buffer.from(actual.image.slice(26), 'base64').toString();

              const expected = createClaimCheck({
                tokenId: '0',
                withdrawableFrom,
                amountString,
                status: 'expired',
              });

              expect(actual).to.deep.equal(expected);
            });

            it('should re-stake when claiming after expiry', async () => {
              await claimCheck.for.alice.approve(accounts.bob.address, '0');

              await expectBalanceOf(accounts.alice).to.equal(0n);

              await expect(cnStakedKLAY.for.bob.claim('0'))
                .to.changeEtherBalance(accounts.alice.address, '0')
                .and.changeTokenBalance(cnStakedKLAY, accounts.alice.address, ETHER);
            });

            it('should issue valid `cancelled` claim check with correct amount string', async () => {
              await claimCheck.for.alice.approve(accounts.bob.address, '0');
              await cnStakedKLAY.for.alice.claim('0');

              const { withdrawableFrom } = await cnStaking.getApprovedStakingWithdrawalInfo('0');

              const amountString = '1';

              const actual = JSON.parse(
                Buffer.from((await claimCheck.tokenURI('0')).slice(28), 'base64').toString(),
              );

              actual.image = Buffer.from(actual.image.slice(26), 'base64').toString();

              const expected = createClaimCheck({
                tokenId: '0',
                withdrawableFrom,
                amountString,
                status: 'cancelled',
              });

              expect(actual).to.deep.equal(expected);
            });

            it('should re-stake to owner when claiming after expiry', async () => {
              await claimCheck.for.alice['safeTransferFrom(address,address,uint256)'](
                accounts.alice.address,
                accounts.bob.address,
                '0',
              );

              await claimCheck.for.bob.approve(accounts.carol.address, '0');

              await expectBalanceOf(accounts.bob).to.equal(0n);

              await expect(cnStakedKLAY.for.carol.claim('0'))
                .to.changeEtherBalances(
                  [
                    accounts.alice.address,
                    accounts.bob.address,
                    accounts.carol.address,
                    cnStakedKLAY.address,
                    cnStaking.address,
                  ],
                  [0n, 0n, 0n, 0n, 0n],
                )
                .and.changeTokenBalances(
                  cnStakedKLAY,
                  [accounts.alice.address, accounts.bob.address, accounts.carol.address],
                  [0n, ETHER, 0n],
                );
            });

            it('should sweep rewards when claiming cancelled claim check', async () => {
              await issueReward(ETHER);

              await expect(cnStakedKLAY.for.alice.claim('0')).to.changeEtherBalances(
                [accounts.alice.address, cnStakedKLAY.address, cnStaking.address],
                [0n, -ETHER, ETHER],
              );
            });
          });
        });
      });
    });

    describe('when alice and bob staked different amount', () => {
      useSnapshot(async () => {
        await cnStakedKLAY.for.alice.stake({ value: ETHER });
        await cnStakedKLAY.for.bob.stake({ value: 2n * ETHER });
      });

      it('should have correct balances and shares', async () => {
        // balances
        await expectBalanceOf(accounts.alice).to.equal(ETHER);
        await expectBalanceOf(accounts.bob).to.equal(2n * ETHER);

        // shares
        await expectSharesOf(accounts.alice).to.equal(ETHER);
        await expectSharesOf(accounts.bob).to.equal(2n * ETHER);
      });

      describe('when reward issued', () => {
        useSnapshot(async () => {
          await issueReward(3n * ETHER);
        });

        it('should distribute rewards based on a percentage of shares', async () => {
          expect(await cnStakedKLAY.totalSupply()).to.equal(6n * ETHER);
          expect(await cnStakedKLAY.totalShares()).to.equal(3n * ETHER);

          await expectBalanceOf(accounts.alice).to.equal(2n * ETHER);
          await expectBalanceOf(accounts.bob).to.equal(4n * ETHER);
        });

        it('should maintain distribution after sweep', async () => {
          await cnStakedKLAY.sweep();

          expect(await cnStakedKLAY.totalSupply()).to.equal(6n * ETHER);
          expect(await cnStakedKLAY.totalShares()).to.equal(3n * ETHER);

          await expectBalanceOf(accounts.alice).to.equal(2n * ETHER);
          await expectBalanceOf(accounts.bob).to.equal(4n * ETHER);
        });

        it('should not distribute rewards to unstaking amounts', async () => {
          await printStats('before unstake');
          log('requesting unstake of 2 cnStakedKLAY from accounts[1]');
          // unstake (2 of 4) from accounts[1] -> 2 cnStakedKLAY, 1 share
          await cnStakedKLAY.for.bob.unstake(2n * ETHER);
          await printStats('after unstake');

          await expectBalanceOf(accounts.bob).to.equal(2n * ETHER);
          await expectSharesOf(accounts.bob).to.equal(ETHER);

          log('issuing reward of 3 KLAY');
          // total staked amount at this point = 4 KLAY
          // total unstaking amount at this point = 2 KLAY
          // meaning, 3 * 4 / 6 KLAY should be distributed to the stakers
          // remaining 3 * 2 / 6 KLAY should be taken as a fee
          await issueReward(3n * ETHER);

          await printStats('after reward phase 2 (before sweep)');
          // final balances and shares
          // accounts[0] - 3 cnStakedKLAY, 1 share
          // accounts[1] - 3 cnStakedKLAY, 1 share
          await expectBalanceOf(accounts.alice).to.equal(3n * ETHER);
          await expectBalanceOf(accounts.bob).to.equal(3n * ETHER);
          await expectSharesOf(accounts.alice).to.equal(ETHER);
          await expectSharesOf(accounts.bob).to.equal(ETHER);

          // performing sweep
          await cnStakedKLAY.sweep();

          await printStats('after sweep');
          // confirming final balances remain the same
          await expectBalanceOf(accounts.alice).to.equal(3n * ETHER);
          await expectBalanceOf(accounts.bob).to.equal(3n * ETHER);
          await expectSharesOf(accounts.alice).to.equal(ETHER);
          await expectSharesOf(accounts.bob).to.equal(ETHER);

          // confirming fee is sent to the fee collector
          await expectBalanceOf(accounts.feeTo).to.equal(ETHER - 1n);
        });
      });
    });
  });

  describe('PeriodicStakingStats', () => {
    useSnapshot();

    it('should be emitted on stake', async () => {
      await expect(cnStakedKLAY.for.alice.stake({ value: ETHER }))
        .to.emit(cnStakedKLAY, 'PeriodicStakingStats')
        .withArgs(ETHER, ETHER);
    });

    it('should not be emitted multiple times within the debounce interval', async () => {
      await cnStakedKLAY.for.alice.stake({ value: ETHER });

      await expect(cnStakedKLAY.for.alice.stake({ value: ETHER })).to.not.emit(
        cnStakedKLAY,
        'PeriodicStakingStats',
      );
    });

    it('should be emitted after the debounce interval', async () => {
      await printStats('initial state');
      await cnStakedKLAY.for.alice.stake({ value: ETHER });
      await printStats('after first stake');

      await time.increase(3600 + 1);

      await expect(cnStakedKLAY.for.alice.stake({ value: ETHER }))
        .to.emit(cnStakedKLAY, 'PeriodicStakingStats')
        .withArgs(2n * ETHER, 2n * ETHER);
    });
  });

  describe('#setPeriodicStakingStatsDebounceInterval()', () => {
    it('should revert when called by non-owner', async () => {
      await expect(cnStakedKLAY.connect(accounts.bob).setPeriodicStakingStatsDebounceInterval(0)).to
        .be.reverted;
    });

    it('should be able to set the interval', async () => {
      await cnStakedKLAY.for.deployer.setPeriodicStakingStatsDebounceInterval(60);

      expect(await cnStakedKLAY.periodicStakingStatsDebounceInterval()).to.equal(60);
    });
  });
});
