import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

export const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

export const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

export function domainSeparator(
  name: string,
  version: BigNumberish,
  chainId: BigNumberish,
  verifyingContract: string,
) {
  return ethers.utils.keccak256(
    ethers.utils._TypedDataEncoder
      .from({ EIP712Domain })
      .encodeData('EIP712Domain', { name, version, chainId, verifyingContract }),
  );
}
