import { ethers } from 'hardhat';

export async function makeEveryoneRich() {
  const allAccounts = await ethers.getSigners();

  // let's make everyone rich
  for (const account of allAccounts) {
    await ethers.provider.send('hardhat_setBalance', [
      account.address,
      '0x' + (0x1c9c380000000n * 10n ** 18n).toString(16),
    ]);
  }
}
