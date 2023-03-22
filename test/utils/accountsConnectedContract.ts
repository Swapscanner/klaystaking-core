import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Accounts } from './accounts';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { FactoryOptions } from '@nomiclabs/hardhat-ethers/types';

type AccountsConnectedContractFor<T, N extends string> = {
  [K in N | 'all']: T;
};
export type AccountsConnectedContract<T, N extends string> = T & {
  for: AccountsConnectedContractFor<T, N>;
};

type DeployAccountsConnectedContractArgs<T extends Contract, N extends string> = {
  accounts: Accounts<N>;
  defaultAccount: SignerWithAddress;
  contract: string;
  args: any[];
  factoryOptions?: FactoryOptions;
};

export async function deployAccountsConnectedContract<T extends Contract, N extends string>({
  accounts,
  defaultAccount,
  contract: contractName,
  args,
  factoryOptions,
}: DeployAccountsConnectedContractArgs<T, N>) {
  const Contract = await ethers.getContractFactory(contractName, factoryOptions);
  const contract = await Contract.deploy(...args);
  const connectedContract = contract.connect(defaultAccount) as AccountsConnectedContract<T, N>;
  connectedContract.for = {} as AccountsConnectedContractFor<T, N>;
  Object.entries(accounts).forEach(([name, account]) => {
    connectedContract.for[name as N] = connectedContract.connect(account as SignerWithAddress) as T;
  });
  return connectedContract;
}
