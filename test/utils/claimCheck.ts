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

export const createNameOfClaimCheck = (tokenId: string) => `Unstaking CNStakedKLAYV2 #${tokenId}`;

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
    default:
      throw new Error('Invalid status' + status);
  }
};

const svgStringForStatus = (status: ClaimCheckStatus) => {
  switch (status) {
    case 'expired':
      return '<circle cx="22" cy="125" r="2" fill="#ff5833"/><text x="28" y="127" class="small">Expired</text>';
    case 'valid':
      return '<circle cx="22" cy="125" r="2" fill="#8fff5a"/><text x="28" y="127" class="small">Claimable</text>';
    case 'pending':
      return '<circle cx="22" cy="125" r="2" fill="#ffef5a"/><text x="28" y="127" class="small">Pending</text>';
    case 'claimed':
      return '<circle cx="22" cy="125" r="2" fill="#9fa8b7"/><text x="28" y="127" class="small">Transferred</text>';
    case 'cancelled':
      return '<circle cx="22" cy="125" r="2" fill="#ff5833"/><text x="28" y="127" class="small">Cancelled</text>';
    default:
      throw new Error('Invalid status' + status);
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
  status,
}: {
  tokenId: string;
  amountString: string;
  withdrawableFrom: BigNumber;
  status: ClaimCheckStatus;
}) => {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 240 240"><style>@font-face{font-family:M300;src:url(data:application/font-woff2;base64,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);}@font-face{font-family:M500;src:url(data:application/font-woff2;base64,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);}svg{font:10px M300;fill:#fff;letter-spacing:0.03em;}.large{font-size:20px;}.small{font-size:7px;}.ss{fill:#0d9488;}.bold{font-family:M500;}.condensed{letter-spacing:0.01em;}</style><rect width="100%" height="100%" fill="#080B11"/><rect x="20" y="136" width="200" height="1" fill="white"/><g class="large condensed ss"><rect x="20" y="15" width="200" height="2"/><text x="20" y="46">Unstaking</text><text x="20" y="72">` +
    `Consensus</text><text x="20" y="98">KLAY #${tokenId}` +
    `</text></g>` +
    svgStringForStatus(status) +
    `<g class="bold"><text x="20" y="157">${amountString.split('.')[0]}` +
    `</text><text x="196" y="157">KLAY</text></g>` +
    `<text x="20" y="168" class="small" fill="#9fa8b7">${
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
