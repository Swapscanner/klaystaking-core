/**
 * render-svg.ts - renders a svg for a given state of a claim check
 *
 * @example tokenId=5, amount=1 ether, state=claimed
 * $ RENDER_SVG_DETAILS=5:1:claimed yarn hardhat run scripts/render-svg.ts
 *
 * @example tokenId=3, amount=1 ether, state=claimable
 * $ RENDER_SVG_DETAILS=3:1:claimable yarn hardhat run scripts/render-svg.ts
 */

import { time } from '@nomicfoundation/hardhat-network-helpers';
import { network } from 'hardhat';
import { setupCNStakedKLAY } from '../test/utils/setupCNStakedKLAY';
import open, { apps } from 'open';

async function main() {
  if (network.name !== 'hardhat') {
    throw new Error('this script is intended to be run on the hardhat network');
  }

  console.error(`parsing RENDER_SVG_DETAILS: ${process.env.RENDER_SVG_DETAILS}`);

  const [desiredTokenId, desiredAmountKLAY, desiredState] = (
    process.env.RENDER_SVG_DETAILS || '0:1:pending'
  ).split(':');

  console.error('rendering svg with details: ', {
    desiredTokenId,
    desiredAmountKLAY,
    desiredState,
  });

  if (!desiredTokenId || !desiredAmountKLAY || !desiredState) {
    throw new Error('required field is empty');
  }

  const desiredAmountPeb =
    BigInt(desiredAmountKLAY.split('.')[0]) * 10n ** 18n +
    BigInt((desiredAmountKLAY.split('.')[1] || '0').padEnd(18, '0'));

  console.error(`desiredAmountPeb: ${desiredAmountPeb}`);

  const { cnStakedKLAY, claimCheck } = await setupCNStakedKLAY();
  await cnStakedKLAY.stake({ value: desiredAmountPeb + 1n * BigInt(desiredTokenId) });
  for (let i = 0n; i < BigInt(desiredTokenId); i++) {
    await cnStakedKLAY.unstake(1n);
  }
  await cnStakedKLAY.unstake(desiredAmountPeb);

  switch (desiredState) {
    case 'pending':
      break;
    case 'claimable':
      await time.increase(86400 * 7 + 1);
      break;
    case 'claimed':
      await time.increase(86400 * 7 + 1);
      await cnStakedKLAY.claim(desiredTokenId);
      break;
    case 'expired':
      await time.increase(86400 * 14 + 1);
      break;
    case 'cancelled':
      await cnStakedKLAY.cancel(desiredTokenId);
      break;
    default:
      throw new Error(`unknown desiredState: ${desiredState}`);
  }

  const { image: svgDataURL } = JSON.parse(
    Buffer.from((await claimCheck.tokenURI(desiredTokenId)).split(',')[1], 'base64').toString(),
  );

  await open(svgDataURL, { app: { name: apps.chrome } });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
