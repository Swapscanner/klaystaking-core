import { ethers } from 'hardhat';
import { deployAccountsConnectedContract } from './accountsConnectedContract';
import { CNStakedKLAYV2Test, ProxyStakedKLAYClaimCheck } from '../../typechain-types';

export type AccountName =
  | 'deployer'
  | 'alice'
  | 'bob'
  | 'carol'
  | 'foundationAdmin'
  | 'cnAdmin'
  | 'feeTo';

export const setupCNStakedKLAY = async () => {
  const allAccounts = await ethers.getSigners();

  // let's make everyone rich
  for (const account of allAccounts) {
    await ethers.provider.send('hardhat_setBalance', [
      account.address,
      '0x' + (0x1c9c380000000n * 10n ** 18n).toString(16),
    ]);
  }

  const [deployer, foundationAdmin, cnAdmin, feeTo, misc, alice, bob, carol] = allAccounts;
  const accounts = { deployer, foundationAdmin, cnAdmin, feeTo, alice, bob, carol };

  // deploy contracts
  const CnStakingV2 = await ethers.getContractFactory('CnStakingV2');
  const cnStaking = await CnStakingV2.deploy(
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
  const cnStakedKLAY = await deployAccountsConnectedContract<CNStakedKLAYV2Test, AccountName>({
    accounts,
    defaultAccount: misc,
    contract: 'CNStakedKLAYV2Test',
    args: [feeTo.address, cnStaking.address],
  });
  await cnStakedKLAY.deployed();

  const claimCheck = await deployAccountsConnectedContract<ProxyStakedKLAYClaimCheck, AccountName>({
    accounts,
    defaultAccount: misc,
    contract: 'ProxyStakedKLAYClaimCheck',
    args: [cnStakedKLAY.address, 'Consensus', 'Unstaking CNStakedKLAYV2', 'usKLAY'],
  });

  // configure contracts
  await cnStakedKLAY.for.deployer.setClaimCheck(claimCheck.address);
  await cnStaking.connect(cnAdmin).submitAddAdmin(cnStakedKLAY.address);

  return { allAccounts, accounts, cnStaking, cnStakedKLAY, claimCheck, misc };
};
