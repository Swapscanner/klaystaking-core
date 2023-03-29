import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { useSnapshot } from './utils/useSnapshot';
import { ethers } from 'hardhat';
import { ERC20VotesCustomBalanceMock } from '../typechain-types';
import { BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';
import { domainSeparator } from './utils/eip712';
import { mine, time } from '@nomicfoundation/hardhat-network-helpers';
import { batchInBlock } from './utils/txpool';

// Ported from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/test/token/ERC20/extensions/ERC20Votes.test.js

const Delegation = [
  { name: 'delegatee', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'expiry', type: 'uint256' },
];

type Delegation = {
  delegatee: string;
  nonce: BigNumberish;
  expiry: BigNumberish;
};

describe('ERC20VotesCustomBalance', () => {
  let holder: SignerWithAddress;
  let recipient: SignerWithAddress;
  let holderDelegatee: SignerWithAddress;
  let other1: SignerWithAddress;
  let other2: SignerWithAddress;

  let token: ERC20VotesCustomBalanceMock;
  let chainId: BigNumber;

  const name = 'My Token';
  const symbol = 'MTKN';
  const version = '1';
  const supply = 10000000000000000000000000n;

  useSnapshot(async () => {
    const allAccounts = await ethers.getSigners();

    // let's make everyone rich
    for (const account of allAccounts) {
      await ethers.provider.send('hardhat_setBalance', [
        account.address,
        '0x' + (0x1c9c380000000n * 10n ** 18n).toString(16),
      ]);
    }

    [holder, recipient, holderDelegatee, other1, other2] = allAccounts;

    const ERC20VotesCustomBalanceMock = await ethers.getContractFactory(
      'ERC20VotesCustomBalanceMock',
    );

    token = await ERC20VotesCustomBalanceMock.deploy(name, symbol);
    await token.deployed();

    chainId = await token.getChainId();
  });

  it('initial nonce is 0', async function () {
    expect(await token.nonces(holder.address)).to.be.equal('0');
  });

  it('domain separator', async function () {
    expect(await token.DOMAIN_SEPARATOR()).to.equal(
      domainSeparator(name, version, chainId, token.address),
    );
  });

  it('minting restriction', async function () {
    const amount = 2n ** 224n;
    await expect(token.mint(holder.address, amount)).to.revertedWith(
      'ERC20Votes: total supply risks overflowing votes',
    );
  });

  it('recent checkpoints', async function () {
    await token.connect(holder).delegate(holder.address);
    for (let i = 0; i < 6; i++) {
      await token.mint(holder.address, 1);
    }
    const block = await ethers.provider.getBlockNumber();
    expect(await token.numCheckpoints(holder.address)).to.be.equal(6);
    // recent
    expect(await token.getPastVotes(holder.address, block - 1)).to.be.equal(5);
    // non-recent
    expect(await token.getPastVotes(holder.address, block - 6)).to.be.equal(0);
  });

  describe('set delegation', function () {
    describe('call', function () {
      it('delegation with balance', async function () {
        await token.mint(holder.address, supply);
        expect(await token.delegates(holder.address)).to.be.equal(ethers.constants.AddressZero);

        await expect(token.connect(holder).delegate(holder.address))
          .to.emit(token, 'DelegateChanged')
          .withArgs(holder.address, ethers.constants.AddressZero, holder.address)
          .and.emit(token, 'DelegateVotesChanged')
          .withArgs(holder.address, '0', supply);

        const blockNumber = await ethers.provider.getBlockNumber();

        expect(await token.delegates(holder.address)).to.be.equal(holder.address);

        expect(await token.getVotes(holder.address)).to.be.equal(supply);
        expect(await token.getPastVotes(holder.address, blockNumber - 1)).to.be.equal('0');
        await mine();
        expect(await token.getPastVotes(holder.address, blockNumber)).to.be.equal(supply);
      });

      it('delegation without balance', async function () {
        expect(await token.delegates(holder.address)).to.be.equal(ethers.constants.AddressZero);

        await expect(token.connect(holder).delegate(holder.address))
          .to.emit(token, 'DelegateChanged')
          .withArgs(holder.address, ethers.constants.AddressZero, holder.address)
          .and.not.emit(token, 'DelegateVotesChanged');

        expect(await token.delegates(holder.address)).to.be.equal(holder.address);
      });
    });

    describe('with signature', function () {
      const delegator = ethers.Wallet.createRandom();
      const delegatorAddress = delegator.address;
      const nonce = 0;

      const buildSignature = (
        chainId: BigNumberish,
        verifyingContract: string,
        message: Delegation,
      ) =>
        delegator
          ._signTypedData({ name, version, chainId, verifyingContract }, { Delegation }, message)
          .then(ethers.utils.splitSignature);

      beforeEach(async function () {
        await token.mint(delegatorAddress, supply);
      });

      it('accept signed delegation', async function () {
        const { v, r, s } = await buildSignature(chainId, token.address, {
          delegatee: delegatorAddress,
          nonce,
          expiry: ethers.constants.MaxUint256,
        });

        expect(await token.delegates(delegatorAddress)).to.be.equal(ethers.constants.AddressZero);

        await expect(
          token.delegateBySig(delegatorAddress, nonce, ethers.constants.MaxUint256, v, r, s),
        )
          .to.emit(token, 'DelegateChanged')
          .withArgs(delegatorAddress, ethers.constants.AddressZero, delegatorAddress)
          .and.emit(token, 'DelegateVotesChanged')
          .withArgs(delegatorAddress, 0, supply);

        const blockNumber = await ethers.provider.getBlockNumber();

        expect(await token.delegates(delegatorAddress)).to.be.equal(delegatorAddress);

        expect(await token.getVotes(delegatorAddress)).to.be.equal(supply);
        expect(await token.getPastVotes(delegatorAddress, blockNumber - 1)).to.be.equal(0);
        await mine();
        expect(await token.getPastVotes(delegatorAddress, blockNumber)).to.be.equal(supply);
      });

      it('rejects reused signature', async function () {
        const { v, r, s } = await buildSignature(chainId, token.address, {
          delegatee: delegatorAddress,
          nonce,
          expiry: ethers.constants.MaxUint256,
        });

        await token.delegateBySig(delegatorAddress, nonce, ethers.constants.MaxUint256, v, r, s);

        await expect(
          token.delegateBySig(delegatorAddress, nonce, ethers.constants.MaxUint256, v, r, s),
        ).to.revertedWith('ERC20Votes: invalid nonce');
      });

      it('rejects bad delegatee', async function () {
        const { v, r, s } = await buildSignature(chainId, token.address, {
          delegatee: delegatorAddress,
          nonce,
          expiry: ethers.constants.MaxUint256,
        });

        await expect(
          token.delegateBySig(holderDelegatee.address, nonce, ethers.constants.MaxUint256, v, r, s),
        )
          .to.emit(token, 'DelegateChanged')
          .withArgs(
            (address: string) => address.toLowerCase() !== delegatorAddress.toLowerCase(),
            ethers.constants.AddressZero,
            holderDelegatee.address,
          );
      });

      it('rejects bad nonce', async function () {
        const { v, r, s } = await buildSignature(chainId, token.address, {
          delegatee: delegatorAddress,
          nonce,
          expiry: ethers.constants.MaxUint256,
        });
        await expect(
          token.delegateBySig(delegatorAddress, nonce + 1, ethers.constants.MaxUint256, v, r, s),
        ).to.revertedWith('ERC20Votes: invalid nonce');
      });

      it('rejects expired permit', async function () {
        const expiry = (await time.latest()) - time.duration.weeks(1);
        const { v, r, s } = await buildSignature(chainId, token.address, {
          delegatee: delegatorAddress,
          nonce,
          expiry,
        });

        await expect(token.delegateBySig(delegatorAddress, nonce, expiry, v, r, s)).to.revertedWith(
          'ERC20Votes: signature expired',
        );
      });
    });
  });

  describe('change delegation', function () {
    beforeEach(async function () {
      await token.mint(holder.address, supply);
      await token.connect(holder).delegate(holder.address);
    });

    it('call', async function () {
      expect(await token.delegates(holder.address)).to.be.equal(holder.address);

      await expect(token.connect(holder).delegate(holderDelegatee.address))
        .to.emit(token, 'DelegateChanged')
        .withArgs(holder.address, holder.address, holderDelegatee.address)
        .and.emit(token, 'DelegateVotesChanged')
        .withArgs(holder.address, supply, 0)
        .and.emit(token, 'DelegateVotesChanged')
        .withArgs(holderDelegatee.address, 0, supply);

      const blockNumber = await ethers.provider.getBlockNumber();

      expect(await token.delegates(holder.address)).to.be.equal(holderDelegatee.address);

      expect(await token.getVotes(holder.address)).to.be.equal(0);
      expect(await token.getVotes(holderDelegatee.address)).to.be.equal(supply);
      expect(await token.getPastVotes(holder.address, blockNumber - 1)).to.be.equal(supply);
      expect(await token.getPastVotes(holderDelegatee.address, blockNumber - 1)).to.be.equal(0);
      await mine();
      expect(await token.getPastVotes(holder.address, blockNumber)).to.be.equal(0);
      expect(await token.getPastVotes(holderDelegatee.address, blockNumber)).to.be.equal(supply);
    });
  });

  describe('transfers', function () {
    let holderVotes: bigint;
    let recipientVotes: bigint;

    beforeEach(async function () {
      await token.mint(holder.address, supply);
    });

    it('no delegation', async function () {
      await expect(token.connect(holder).transfer(recipient.address, 1))
        .to.emit(token, 'Transfer')
        .withArgs(holder.address, recipient.address, 1)
        .and.not.emit(token, 'DelegateVotesChanged');

      holderVotes = 0n;
      recipientVotes = 0n;
    });

    it('sender delegation', async function () {
      await token.connect(holder).delegate(holder.address);

      const receipt = token.connect(holder).transfer(recipient.address, 1);
      await expect(receipt)
        .to.emit(token, 'Transfer')
        .withArgs(holder.address, recipient.address, 1)
        .and.emit(token, 'DelegateVotesChanged')
        .withArgs(holder.address, supply, supply - 1n);

      const logs = await receipt
        .then((r) => r.wait())
        .then((w) => w.logs.map((log) => ({ log, parsed: token.interface.parseLog(log) })));

      const transferLogIndex =
        logs.find(({ parsed }) => parsed.name == 'Transfer')?.log.logIndex ?? -1;

      expect(
        logs
          .filter(({ parsed }) => parsed.name == 'DelegateVotesChanged')
          .every(({ log: { logIndex } }) => transferLogIndex < logIndex),
      ).to.be.equal(true);

      holderVotes = supply - 1n;
      recipientVotes = 0n;
    });

    it('receiver delegation', async function () {
      await token.connect(recipient).delegate(recipient.address);

      const receipt = token.connect(holder).transfer(recipient.address, 1);
      await expect(receipt)
        .to.emit(token, 'Transfer')
        .withArgs(holder.address, recipient.address, 1)
        .and.emit(token, 'DelegateVotesChanged')
        .withArgs(recipient.address, 0n, 1n);

      const logs = await receipt
        .then((r) => r.wait())
        .then((w) => w.logs.map((log) => ({ log, parsed: token.interface.parseLog(log) })));

      const transferLogIndex =
        logs.find(({ parsed }) => parsed.name == 'Transfer')?.log.logIndex ?? -1;

      expect(
        logs
          .filter(({ parsed }) => parsed.name == 'DelegateVotesChanged')
          .every(({ log: { logIndex } }) => transferLogIndex < logIndex),
      ).to.be.equal(true);

      holderVotes = 0n;
      recipientVotes = 1n;
    });

    it('full delegation', async function () {
      await token.connect(holder).delegate(holder.address);
      await token.connect(recipient).delegate(recipient.address);

      const receipt = token.connect(holder).transfer(recipient.address, 1);
      await expect(receipt)
        .to.emit(token, 'Transfer')
        .withArgs(holder.address, recipient.address, 1)
        .and.emit(token, 'DelegateVotesChanged')
        .withArgs(holder.address, supply, supply - 1n)
        .and.emit(token, 'DelegateVotesChanged')
        .withArgs(recipient.address, 0n, 1n);

      const logs = await receipt
        .then((r) => r.wait())
        .then((w) => w.logs.map((log) => ({ log, parsed: token.interface.parseLog(log) })));

      const transferLogIndex =
        logs.find(({ parsed }) => parsed.name == 'Transfer')?.log.logIndex ?? -1;

      expect(
        logs
          .filter(({ parsed }) => parsed.name == 'DelegateVotesChanged')
          .every(({ log: { logIndex } }) => transferLogIndex < logIndex),
      ).to.be.equal(true);

      holderVotes = supply - 1n;
      recipientVotes = 1n;
    });

    afterEach(async function () {
      expect(await token.getVotes(holder.address)).to.be.equal(holderVotes);
      expect(await token.getVotes(recipient.address)).to.be.equal(recipientVotes);

      // need to advance 2 blocks to see the effect of a transfer on "getPastVotes"
      const blockNumber = await time.latestBlock();
      await mine();
      expect(await token.getPastVotes(holder.address, blockNumber)).to.be.equal(holderVotes);
      expect(await token.getPastVotes(recipient.address, blockNumber)).to.be.equal(recipientVotes);
    });
  });

  // The following tests are a adaptation of https://github.com/compound-finance/compound-protocol/blob/master/tests/Governance/CompTest.js.
  describe('Compound test suite', function () {
    beforeEach(async function () {
      await token.mint(holder.address, supply);
    });

    describe('balanceOf', function () {
      it('grants to initial account', async function () {
        expect(await token.balanceOf(holder.address)).to.be.equal(10000000000000000000000000n);
      });
    });

    describe('numCheckpoints', function () {
      it('returns the number of checkpoints for a delegate', async function () {
        await token.connect(holder).transfer(recipient.address, '100'); //give an account a few tokens for readability
        expect(await token.numCheckpoints(other1.address)).to.be.equal(0);

        const t1 = await token
          .connect(recipient)
          .delegate(other1.address)
          .then((tx) => tx.wait());
        expect(await token.numCheckpoints(other1.address)).to.be.equal(1);

        const t2 = await token
          .connect(recipient)
          .transfer(other2.address, 10)
          .then((tx) => tx.wait());
        expect(await token.numCheckpoints(other1.address)).to.be.equal(2);

        const t3 = await token
          .connect(recipient)
          .transfer(other2.address, 10)
          .then((tx) => tx.wait());
        expect(await token.numCheckpoints(other1.address)).to.be.equal(3);

        const t4 = await token
          .connect(holder)
          .transfer(recipient.address, 20)
          .then((tx) => tx.wait());
        expect(await token.numCheckpoints(other1.address)).to.be.equal(4);

        expect(await token.checkpoints(other1.address, 0)).to.be.deep.equal([
          t1.blockNumber.toString(),
          '100',
        ]);
        expect(await token.checkpoints(other1.address, 1)).to.be.deep.equal([
          t2.blockNumber.toString(),
          '90',
        ]);
        expect(await token.checkpoints(other1.address, 2)).to.be.deep.equal([
          t3.blockNumber.toString(),
          '80',
        ]);
        expect(await token.checkpoints(other1.address, 3)).to.be.deep.equal([
          t4.blockNumber.toString(),
          '100',
        ]);

        await mine();
        expect(await token.getPastVotes(other1.address, t1.blockNumber)).to.equal(100);
        expect(await token.getPastVotes(other1.address, t2.blockNumber)).to.equal(90);
        expect(await token.getPastVotes(other1.address, t3.blockNumber)).to.equal(80);
        expect(await token.getPastVotes(other1.address, t4.blockNumber)).to.equal(100);
      });

      it('does not add more than one checkpoint in a block', async function () {
        await token.connect(holder).transfer(recipient.address, '100');
        expect(await token.numCheckpoints(other1.address)).to.equal(0);

        const [t1] = await batchInBlock([
          () => token.connect(recipient).delegate(other1.address, { gasLimit: 100000 }),
          () => token.connect(recipient).transfer(other2.address, 10, { gasLimit: 100000 }),
          () => token.connect(recipient).transfer(other2.address, 10, { gasLimit: 100000 }),
        ]);
        expect(await token.numCheckpoints(other1.address)).to.be.equal(1);
        expect(await token.checkpoints(other1.address, 0)).to.be.deep.equal([
          t1.blockNumber.toString(),
          '80',
        ]);
        // expectReve(await token.checkpoints(other1, 1)).to.be.deep.equal([ '0', '0' ]); // Reverts due to array overflow check
        // expect(await token.checkpoints(other1, 2)).to.be.deep.equal([ '0', '0' ]); // Reverts due to array overflow check

        const t4 = await token
          .connect(holder)
          .transfer(recipient.address, 20)
          .then((tx) => tx.wait());
        expect(await token.numCheckpoints(other1.address)).to.be.equal(2);
        expect(await token.checkpoints(other1.address, 1)).to.be.deep.equal([
          t4.blockNumber.toString(),
          '100',
        ]);
      });
    });

    describe('getPastVotes', function () {
      it('reverts if block number >= current block', async function () {
        await expect(token.getPastVotes(other1.address, 5e10)).to.revertedWith(
          'ERC20Votes: block not yet mined',
        );
      });

      it('returns 0 if there are no checkpoints', async function () {
        expect(await token.getPastVotes(other1.address, 0)).to.equal(0);
      });

      it('returns the latest block if >= last checkpoint block', async function () {
        const t1 = await token
          .connect(holder)
          .delegate(other1.address)
          .then((tx) => tx.wait());
        await mine();
        await mine();

        expect(await token.getPastVotes(other1.address, t1.blockNumber)).to.be.equal(
          10000000000000000000000000n,
        );
        expect(await token.getPastVotes(other1.address, t1.blockNumber + 1)).to.be.equal(
          10000000000000000000000000n,
        );
      });

      it('returns zero if < first checkpoint block', async function () {
        await mine();
        const t1 = await token
          .connect(holder)
          .delegate(other1.address)
          .then((tx) => tx.wait());
        await mine();
        await mine();

        expect(await token.getPastVotes(other1.address, t1.blockNumber - 1)).to.equal(0);
        expect(await token.getPastVotes(other1.address, t1.blockNumber + 1)).to.equal(
          10000000000000000000000000n,
        );
      });

      it('generally returns the voting balance at the appropriate checkpoint', async function () {
        const t1 = await token
          .connect(holder)
          .delegate(other1.address)
          .then((tx) => tx.wait());
        await mine();
        await mine();
        const t2 = await token
          .connect(holder)
          .transfer(other2.address, 10)
          .then((tx) => tx.wait());
        await mine();
        await mine();
        const t3 = await token
          .connect(holder)
          .transfer(other2.address, 10)
          .then((tx) => tx.wait());
        await mine();
        await mine();
        const t4 = await token
          .connect(other2)
          .transfer(holder.address, 20)
          .then((tx) => tx.wait());
        await mine();
        await mine();

        expect(await token.getPastVotes(other1.address, t1.blockNumber - 1)).to.equal(0);
        expect(await token.getPastVotes(other1.address, t1.blockNumber)).to.equal(
          10000000000000000000000000n,
        );
        expect(await token.getPastVotes(other1.address, t1.blockNumber + 1)).to.equal(
          10000000000000000000000000n,
        );
        expect(await token.getPastVotes(other1.address, t2.blockNumber)).to.equal(
          9999999999999999999999990n,
        );
        expect(await token.getPastVotes(other1.address, t2.blockNumber + 1)).to.equal(
          9999999999999999999999990n,
        );
        expect(await token.getPastVotes(other1.address, t3.blockNumber)).to.equal(
          9999999999999999999999980n,
        );
        expect(await token.getPastVotes(other1.address, t3.blockNumber + 1)).to.equal(
          9999999999999999999999980n,
        );
        expect(await token.getPastVotes(other1.address, t4.blockNumber)).to.equal(
          10000000000000000000000000n,
        );
        expect(await token.getPastVotes(other1.address, t4.blockNumber + 1)).to.equal(
          10000000000000000000000000n,
        );
      });
    });
  });

  describe('getPastTotalSupply', function () {
    beforeEach(async function () {
      await token.connect(holder).delegate(holder.address);
    });

    it('reverts if block number >= current block', async function () {
      await expect(token.getPastTotalSupply(5e10)).to.revertedWith(
        'ERC20Votes: block not yet mined',
      );
    });

    it('returns 0 if there are no checkpoints', async function () {
      expect(await token.getPastTotalSupply(0)).to.be.equal(0);
    });

    it('returns the latest block if >= last checkpoint block', async function () {
      const t1 = await token.mint(holder.address, supply).then((tx) => tx.wait());

      await mine();
      await mine();

      expect(await token.getPastTotalSupply(t1.blockNumber)).to.equal(supply);
      expect(await token.getPastTotalSupply(t1.blockNumber + 1)).to.equal(supply);
    });

    it('returns zero if < first checkpoint block', async function () {
      await mine();
      const t1 = await token.mint(holder.address, supply).then((tx) => tx.wait());
      await mine();
      await mine();

      expect(await token.getPastTotalSupply(t1.blockNumber - 1)).to.be.equal(0);
      expect(await token.getPastTotalSupply(t1.blockNumber + 1)).to.be.equal(
        10000000000000000000000000n,
      );
    });

    it('generally returns the voting balance at the appropriate checkpoint', async function () {
      const t1 = await token.mint(holder.address, supply).then((tx) => tx.wait());
      await mine();
      await mine();
      const t2 = await token.burn(holder.address, 10).then((tx) => tx.wait());
      await mine();
      await mine();
      const t3 = await token.burn(holder.address, 10).then((tx) => tx.wait());
      await mine();
      await mine();
      const t4 = await token.mint(holder.address, 20).then((tx) => tx.wait());
      await mine();
      await mine();

      expect(await token.getPastTotalSupply(t1.blockNumber - 1)).to.equal(0n);
      expect(await token.getPastTotalSupply(t1.blockNumber)).to.equal(10000000000000000000000000n);
      expect(await token.getPastTotalSupply(t1.blockNumber + 1)).to.equal(
        10000000000000000000000000n,
      );
      expect(await token.getPastTotalSupply(t2.blockNumber)).to.equal(9999999999999999999999990n);
      expect(await token.getPastTotalSupply(t2.blockNumber + 1)).to.equal(
        9999999999999999999999990n,
      );
      expect(await token.getPastTotalSupply(t3.blockNumber)).to.equal(9999999999999999999999980n);
      expect(await token.getPastTotalSupply(t3.blockNumber + 1)).to.equal(
        9999999999999999999999980n,
      );
      expect(await token.getPastTotalSupply(t4.blockNumber)).to.equal(10000000000000000000000000n);
      expect(await token.getPastTotalSupply(t4.blockNumber + 1)).to.equal(
        10000000000000000000000000n,
      );
    });
  });
});
