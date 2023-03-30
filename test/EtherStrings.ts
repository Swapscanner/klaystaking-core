import { ethers } from 'hardhat';
import { useSnapshot } from './utils/useSnapshot';
import { EtherStringsTest } from '../typechain-types';
import { expect } from 'chai';
import { randomBytes } from 'crypto';

type TestCase = [bigint, [string, string]];

const TEST_CASES: TestCase[] = [
  [0n, ['0', '']],
  [1000n * 10n ** 18n + 1n, ['1,000', '.000000000000000001']],
];

function convertToEtherString(wei: bigint): [string, string] {
  const ether = wei / 10n ** 18n;
  const decimal = wei % 10n ** 18n;
  const decimalString = decimal === 0n ? '' : '.' + decimal.toString().padStart(18, '0');
  return [ether.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','), decimalString];
}

describe('EtherStrings', () => {
  let etherStrings: EtherStringsTest;

  useSnapshot(async () => {
    const EtherStringsTest = await ethers.getContractFactory('EtherStringsTest');
    etherStrings = await EtherStringsTest.deploy();
    await etherStrings.deployed();
    return etherStrings;
  });

  it('should convert weis to ether', async () => {
    for (const [wei, [ether, decimal]] of TEST_CASES) {
      expect(await etherStrings.callStatic.toEtherString(wei)).to.deep.equal([ether, decimal]);
    }
  });

  it('should pass fuzzing', async () => {
    for (let i = 0; i < 100; i += 1) {
      const int = BigInt('0x' + randomBytes(32).toString('hex'));
      expect(await etherStrings.callStatic.toEtherString(int)).to.deep.equal(
        convertToEtherString(int),
      );
    }
  });
});
