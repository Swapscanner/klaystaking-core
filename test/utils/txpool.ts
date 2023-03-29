import { expect } from 'chai';
import { ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { promisify } from 'util';

const queue = promisify(setImmediate);

export async function countPendingTransactions() {
  return parseInt(await ethers.provider.send('eth_getBlockTransactionCountByNumber', ['pending']));
}

export async function batchInBlock(txs: (() => Promise<ContractTransaction>)[]) {
  try {
    // disable auto-mining
    await ethers.provider.send('evm_setAutomine', [false]);
    // send all transactions
    const promises = txs.map((fn) => fn().then((tx) => tx.wait()));
    // wait for node to have all pending transactions
    while (txs.length > (await countPendingTransactions())) {
      await queue();
    }
    // mine one block
    await ethers.provider.send('evm_mine', []);
    // fetch receipts
    const receipts = await Promise.all(promises);
    // Sanity check, all tx should be in the same block
    const minedBlocks = new Set(receipts.map(({ blockNumber }) => blockNumber));
    expect(minedBlocks.size).to.equal(1);

    return receipts;
  } finally {
    // enable auto-mining
    await ethers.provider.send('evm_setAutomine', [true]);
  }
}
