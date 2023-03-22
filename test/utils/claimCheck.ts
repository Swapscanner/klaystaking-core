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
  tokenId,
  amountString,
  withdrawableFrom,
}: {
  tokenId: string;
  amountString: string;
  withdrawableFrom: BigNumber;
  status: ClaimCheckStatus;
}) => {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 240 240"><style>@font-face{font-family:M300;src:url(data:application/font-woff2;base64,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);}@font-face{font-family:M500;src:url(data:application/font-woff2;base64,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);}svg{font:10px M300;fill:#fff;letter-spacing:0.03em;}.large{font-size:20px;}.small{font-size:7px;}.ss{fill:#0d9488;}.bold{font-family:M500;}.condensed{letter-spacing:0.01em;}</style><rect width="100%" height="100%" fill="#080B11"/><rect x="20" y="136" width="200" height="1" fill="white"/><g class="large condensed ss"><rect x="20" y="15" width="200" height="2"/><text x="20" y="46">Unstaking</text><text x="20" y="72">` +
    `Consensus Node Staked</text><text x="20" y="98">KLAY #${tokenId}` +
    `</text></g><g class="bold"><text x="20" y="157">${amountString.split('.')[0]}` +
    `</text><text x="196" y="157">KLAY</text></g>` +
    `<text x="20" y="168" class="small">${
      amountString.split('.')[1] ? '.' + amountString.split('.')[1] : ''
    }` +
    `</text><text x="20" y="201">Claimable from</text>` +
    `<text x="20" y="217" class="bold">${withdrawableFromDate(withdrawableFrom)} UTC</text></svg>`
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
  image: createImageOfClaimCheck({ tokenId, amountString, withdrawableFrom, status }),
});
