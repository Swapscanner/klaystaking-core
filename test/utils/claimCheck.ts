import { BigNumber } from 'ethers';

const withdrawableFromDate = (withdrawableFrom: BigNumber) => {
  return new Date(+withdrawableFrom.toString() * 1000)
    .toISOString()
    .replace(/\.[0-9]+Z$/, '')
    .replace(/T/, ' ');
};

const expiresAtDate = (withdrawableFrom: BigNumber) => {
  return new Date(+withdrawableFrom.toString() * 1000 + 86400 * 1000 * 7)
    .toISOString()
    .replace(/\.[0-9]+Z$/, '')
    .replace(/T/, ' ');
};

export const createNameOfClaimCheck = (tokenId: string) => `Unstaking CNStakedKLAY #${tokenId}`;

type ClaimCheckStatus = 'expired' | 'valid' | 'pending' | 'claimed' | 'cancelled';
const descStringForStatus = (status: ClaimCheckStatus) => {
  switch (status) {
    case 'expired':
      return 'Expired: claiming will re-stake the amount.';
    case 'valid':
      return 'Valid: Can be claimed.';
    case 'pending':
      return 'Pending: cannot be claimed yet.';
    case 'claimed':
      return 'Already been claimed.';
    case 'cancelled':
      return 'Cancelled.';
  }
};

export const createDescriptionOfClaimCheck = ({
  withdrawableFrom,
  amountString,
  status,
}: {
  withdrawableFrom: BigNumber;
  amountString: string;
  status: ClaimCheckStatus;
}) => {
  return (
    `Claim check for ${amountString} KLAY. Can be claimed after ${withdrawableFromDate(
      withdrawableFrom,
    )} ` +
    `UTC and expires at ${expiresAtDate(withdrawableFrom)} UTC. Claiming after expiry will ` +
    `re-stake the tokens back to the owner. ${descStringForStatus(status)}`
  );
};

export const createImageOfClaimCheck = ({
  amountString,
  withdrawableFrom,
  status,
}: {
  amountString: string;
  withdrawableFrom: BigNumber;
  status: ClaimCheckStatus;
}) => {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base{` +
    `fill:white;font-family:serif;font-size:14px;}</style>` +
    `<rect width="100%" height="100%" fill="black"/>` +
    `<text x="10" y="20" class="base">Unstaking CNStakedKLAY #0</text>` +
    `<text x="10" y="60" class="base">Amount: ${amountString} KLAY</text>` +
    `<text x="10" y="80" class="base">Withdrawable from: ${withdrawableFromDate(
      withdrawableFrom,
    )} UTC </text>` +
    `<text x="10" y="100" class="base">Expires at: ${expiresAtDate(withdrawableFrom)} UTC</text>` +
    `<text x="10" y="140" class="base">State: ${descStringForStatus(status)}</text>` +
    `</svg>`
  );
};

export const createClaimCheck = ({
  tokenId,
  withdrawableFrom,
  amountString,
  status,
}: {
  tokenId: string;
  withdrawableFrom: BigNumber;
  amountString: string;
  status: ClaimCheckStatus;
}) => ({
  name: createNameOfClaimCheck(tokenId),
  description: createDescriptionOfClaimCheck({ withdrawableFrom, amountString, status }),
  image: createImageOfClaimCheck({ amountString, withdrawableFrom, status }),
});
