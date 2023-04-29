import { ethers } from 'hardhat';
import { deployAccountsConnectedContract } from './accountsConnectedContract';
import { CNStakedKLAYV2Mock, CnStakingV2, ProxyStakedKLAYClaimCheck } from '../../typechain-types';
import { makeEveryoneRich } from './makeEveryoneRich';

export type AccountName =
  | 'deployer'
  | 'alice'
  | 'bob'
  | 'carol'
  | 'foundationAdmin'
  | 'cnAdmin'
  | 'feeTo';

export const setupCNStakedKLAY = async () => {
  await makeEveryoneRich();

  const allAccounts = await ethers.getSigners();

  const [deployer, foundationAdmin, cnAdmin, feeTo, misc, alice, bob, carol] = allAccounts;
  const accounts = { deployer, foundationAdmin, cnAdmin, feeTo, alice, bob, carol };

  // deploy contracts
  const AddressBookMock = await ethers.getContractFactory('AddressBookMock');
  await ethers.provider.send('hardhat_setCode', [
    '0x0000000000000000000000000000000000000400',
    AddressBookMock.bytecode,
  ]);

  const cnStaking = await deployAccountsConnectedContract<CnStakingV2, AccountName>({
    accounts,
    defaultAccount: misc,
    contract: 'CnStakingV2',
    args: [
      foundationAdmin.address,
      foundationAdmin.address,
      foundationAdmin.address,
      [cnAdmin.address],
      1,
      [Math.floor(Date.now() / 1000) + 10],
      [1],
    ],
  });
  await cnStaking.for.foundationAdmin.setGCId(1);
  // await cnStaking.setStakingTracker(cnStaking.address, { from: accounts[1] });
  await cnStaking.for.foundationAdmin.reviewInitialConditions();
  await cnStaking.for.cnAdmin.reviewInitialConditions();
  await cnStaking.depositLockupStakingAndInit({ value: '1' });

  // deploy contracts
  const cnStakedKLAY = await deployAccountsConnectedContract<CNStakedKLAYV2Mock, AccountName>({
    accounts,
    defaultAccount: misc,
    contract: 'CNStakedKLAYV2Mock',
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
  await cnStaking.for.cnAdmin.submitAddAdmin(cnStakedKLAY.address);

  return { allAccounts, accounts, cnStaking, cnStakedKLAY, claimCheck, misc };
};
