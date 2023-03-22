import { ethers } from 'hardhat';

const takeSnapshot = async () => {
  return ethers.provider.send('evm_snapshot', []);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const revertToSnapshot = async (snapshot: any) => {
  return ethers.provider.send('evm_revert', [snapshot]);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stack: any[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mutate = (t: any) => Promise<any>;

export const useSnapshot = (mutate: Mutate = () => Promise.resolve()) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
