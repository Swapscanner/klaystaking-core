import { ethers } from 'hardhat';
import { useSnapshot } from './utils/useSnapshot';
import { TimestampStringsTest } from '../typechain-types';
import { expect } from 'chai';

describe('TimestampStrings', () => {
  let timestampStrings: TimestampStringsTest;

  useSnapshot(async () => {
    const TimestampStringsTest = await ethers.getContractFactory('TimestampStringsTest');
    timestampStrings = await TimestampStringsTest.deploy();
    await timestampStrings.deployed();
    return timestampStrings;
  });

  it('should pass fuzzing', async () => {
    const now = Date.now();

    for (let i = 0; i < 100; i += 1) {
      const randomDate = new Date(now + Math.random() * 86400 * 1000 * 365 * 200);
      const timestamp = Math.floor(randomDate.getTime() / 1000);
      const expected = randomDate.toISOString().replace(/T/, ' ').replace(/\..+/, '');
      expect(await timestampStrings.toUTCString(timestamp)).to.equal(expected);
    }
  });
});
