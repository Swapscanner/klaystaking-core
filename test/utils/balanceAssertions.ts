import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

export const expectEtherBalanceOf = (addressOrAccount: string | { address: string }) =>
  expect(
    ethers.provider.getBalance(
      typeof addressOrAccount === 'string' ? addressOrAccount : addressOrAccount.address,
    ),
  ).eventually;
