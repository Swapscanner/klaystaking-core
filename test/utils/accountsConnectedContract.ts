import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Accounts } from './accounts';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

type AccountsConnectedContractFor<T, N extends string> = {
  [K in N | 'all']: T;
};
export type AccountsConnectedContract<T, N extends string> = T & {
  for: AccountsConnectedContractFor<T, N>;
};

export async function deployAccountsConnectedContract<T extends Contract, N extends string>(
  accounts: Accounts<N>,
  miscAccount: SignerWithAddress,
  contractName: string,
  ...deployArgs: any[]
) {
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(...deployArgs);
  const connectedContract = contract.connect(miscAccount) as AccountsConnectedContract<T, N>;
  connectedContract.for = {} as AccountsConnectedContractFor<T, N>;
  Object.entries(accounts).forEach(([name, account]) => {
    connectedContract.for[name as N] = connectedContract.connect(account as SignerWithAddress) as T;
  });
  return connectedContract;
}
