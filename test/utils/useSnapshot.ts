import { ethers } from 'hardhat';

const takeSnapshot = async () => {
  return ethers.provider.send('evm_snapshot', []);
};

const revertToSnapshot = async (snapshot: any) => {
  return ethers.provider.send('evm_revert', [snapshot]);
};

const stack: any[] = [];

type Mutate = (t: any) => Promise<any>;

export const useSnapshot = (mutate: Mutate = (_: any) => Promise.resolve()) => {
  let s: any;

  before(async () => {
    s = await takeSnapshot();

    await mutate(this);

    stack.push(await takeSnapshot());
  });

  afterEach(async () => {
    await revertToSnapshot(stack.pop());
    stack.push(await takeSnapshot());
  });

  after(async () => {
    await revertToSnapshot(s);
  });
};
