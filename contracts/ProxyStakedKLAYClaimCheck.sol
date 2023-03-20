// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Base64.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import './libs/BokkyPooBahsDateTimeLibrary.sol';
import './ProxyStakedKLAY.sol';

/**
 * @dev Claim check for ProxyStakedKLAY.
 * This contract should be deployed by an EOA in order to be registered and managed on OpenSea.
 */
contract ProxyStakedKLAYClaimCheck is ERC721Enumerable, Ownable {
  ProxyStakedKLAY public staking;

  constructor(
    ProxyStakedKLAY _staking
  )
    ERC721(
      string(abi.encodePacked('Unstaking ', _staking.name())),
      string(abi.encodePacked('u', _staking.symbol()))
    )
    Ownable()
  {
    staking = _staking;
    transferOwnership(address(_staking));
  }

  function mint(address to, uint256 tokenId) external onlyOwner {
    _mint(to, tokenId);
  }

  function burn(uint256 tokenId) external onlyOwner {
    _burn(tokenId);
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    uint256 stakeLockup = staking.withdrawalRequestTTL();

    uint256 value;
    uint256 withdrawableFrom;
    ProxyStakedKLAY.WithdrawalRequestState state;

    (value, withdrawableFrom, state) = staking.withdrawalRequestInfo(tokenId);

    string memory descString = '';
    if (state == ProxyStakedKLAY.WithdrawalRequestState.Unknown) {
      if (withdrawableFrom + stakeLockup < block.timestamp) {
        descString = 'Expired: claiming will re-stake the amount';
      } else if (withdrawableFrom < block.timestamp) {
        descString = 'Valid: Can be claimed';
      } else {
        descString = 'Pending: cannot be claimed yet';
      }
    } else if (state == ProxyStakedKLAY.WithdrawalRequestState.Transferred) {
      descString = 'Already been claimed';
    } else if (state == ProxyStakedKLAY.WithdrawalRequestState.Cancelled) {
      descString = 'Cancelled';
    } else {
      revert('Unknown withdrawal request state');
    }

    string memory tokenIdString = Strings.toString(tokenId);
    string memory valueString = _weiToReadableEther(value);
    string memory withdrawableFromString = _timestampToUTCDate(withdrawableFrom);
    string memory expiresAtString = _timestampToUTCDate(withdrawableFrom + stakeLockup);

    bytes memory svg = abi.encodePacked(
      '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base{fill:white;font-family:serif;font-size:14px;}</style><rect width="100%" height="100%" fill="black"/><text x="10" y="20" class="base">',
      name(),
      ' #',
      tokenIdString,
      '</text><text x="10" y="60" class="base">Amount: ',
      valueString,
      ' KLAY</text><text x="10" y="80" class="base">'
    );

    svg = abi.encodePacked(
      svg,
      'Withdrawable from: ',
      withdrawableFromString,
      ' UTC </text><text x="10" y="100" class="base">Expires at: ',
      expiresAtString,
      ' UTC</text><text x="10" y="140" class="base">State: ',
      descString,
      '.</text></svg>'
    );

    bytes memory json = abi.encodePacked(
      '{"name":"',
      name(),
      ' #',
      tokenIdString,
      '","description":"Claim check for ',
      valueString,
      ' KLAY. Can be claimed after ',
      withdrawableFromString,
      ' UTC and expires at ',
      expiresAtString
    );

    json = abi.encodePacked(
      json,
      ' UTC. Claiming after expiry will re-stake the tokens back to the owner. ',
      descString,
      '.","image":"data:image/svg+xml;base64,',
      Base64.encode(svg),
      '"}'
    );

    return string(abi.encodePacked('data:application/json;base64,', Base64.encode(json)));
  }

  /// inheritances

  /// readable utils

  function _weiToReadableEther(uint256 weiAmount) private pure returns (string memory) {
    uint256 integerPart = weiAmount / 1e18;
    uint256 decimalPart = weiAmount % 1e18;

    string memory integerPartString = Strings.toString(integerPart);
    string memory decimalPartString = Strings.toString(decimalPart);

    uint256 integerPartLength = bytes(integerPartString).length;
    uint256 decimalPartLength = bytes(decimalPartString).length;

    uint256 commaCount = (integerPartLength - 1) / 3;

    bytes memory result = new bytes(integerPartLength + commaCount + decimalPartLength + 1);

    uint256 resultIndex = 0;
    for (uint256 i = 0; i < integerPartLength; i++) {
      if (i > 0 && (integerPartLength - i) % 3 == 0) {
        result[resultIndex] = ',';
        resultIndex++;
      }

      result[resultIndex] = bytes(integerPartString)[i];
      resultIndex++;
    }

    result[resultIndex] = '.';
    resultIndex++;

    for (uint256 i = 0; i < decimalPartLength; i++) {
      result[resultIndex] = bytes(decimalPartString)[i];
      resultIndex++;
    }

    return string(result);
  }

  function _timestampToUTCDate(uint256 timestamp) private pure returns (string memory) {
    uint256 year;
    uint256 month;
    uint256 day;
    uint256 hour;
    uint256 minute;
    uint256 second;

    (year, month, day, hour, minute, second) = BokkyPooBahsDateTimeLibrary.timestampToDateTime(
      timestamp
    );

    string memory yearString = Strings.toString(year);
    string memory monthString = Strings.toString(month);
    string memory dayString = Strings.toString(day);
    string memory hourString = Strings.toString(hour);
    string memory minuteString = Strings.toString(minute);
    string memory secondString = Strings.toString(second);

    if (bytes(monthString).length == 1) {
      monthString = string(abi.encodePacked('0', monthString));
    }

    if (bytes(dayString).length == 1) {
      dayString = string(abi.encodePacked('0', dayString));
    }

    if (bytes(hourString).length == 1) {
      hourString = string(abi.encodePacked('0', hourString));
    }

    if (bytes(minuteString).length == 1) {
      minuteString = string(abi.encodePacked('0', minuteString));
    }

    if (bytes(secondString).length == 1) {
      secondString = string(abi.encodePacked('0', secondString));
    }

    return
      string(
        abi.encodePacked(
          yearString,
          '-',
          monthString,
          '-',
          dayString,
          ' ',
          hourString,
          ':',
          minuteString,
          ':',
          secondString
        )
      );
  }
}
