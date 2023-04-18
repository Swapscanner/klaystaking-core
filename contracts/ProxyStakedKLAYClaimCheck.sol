// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Base64.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import './cnstakinginterfaces/CNStakingInterface.sol';
import './external/BokkyPooBahsDateTimeLibrary.sol';
import './interfaces/IProxyStakedKLAYClaimCheck.sol';
import './libraries/Fonts.sol';
import './libraries/EtherStrings.sol';
import './libraries/TimestampStrings.sol';
import './ProxyStakedKLAY.sol';

/**
 * @title ProxyStakedKLAYClaimCheck
 * @author Swapscanner
 * @notice Claim check represents unstaking requests for {ProxyStakedKLAYUnstakeable}.
 *
 * This contract should be deployed by an EOA in order to be registered and managed on OpenSea, ...
 */
contract ProxyStakedKLAYClaimCheck is IProxyStakedKLAYClaimCheck, ERC721Enumerable, Ownable {
  ProxyStakedKLAY public immutable staking;
  string private _svgTitle;

  constructor(
    ProxyStakedKLAY _staking,
    string memory svgTitle_,
    string memory name,
    string memory symbol
  ) ERC721(name, symbol) Ownable() {
    staking = _staking;
    _svgTitle = svgTitle_;
    transferOwnership(address(_staking));
  }

  function mint(address to, uint256 tokenId) external onlyOwner {
    _mint(to, tokenId);
  }

  function burn(uint256 tokenId) external onlyOwner {
    _burn(tokenId);
  }

  function _tokenStateSVG(TokenState state) private pure returns (string memory svg) {
    string memory fill = '';
    string memory title = '';

    if (state == TokenState.Pending) {
      fill = 'ffef5a';
      title = 'Pending';
    } else if (state == TokenState.Claimable) {
      fill = '8fff5a';
      title = 'Claimable';
    } else if (state == TokenState.Transferred) {
      fill = '9fa8b7';
      title = 'Transferred';
    } else if (state == TokenState.Expired) {
      fill = 'ff5833';
      title = 'Expired';
    } else if (state == TokenState.Cancelled) {
      fill = 'ff5833';
      title = 'Cancelled';
    } else {
      revert('Unknown token state');
    }

    return
      string(
        abi.encodePacked(
          '<circle cx="22" cy="125" r="2" fill="#',
          fill,
          '"/><text x="28" y="127" class="small">',
          title,
          '</text>'
        )
      );
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    uint256 stakeLockup = staking.withdrawalRequestTTL();

    uint256 value;
    uint256 withdrawableFrom;
    CNStakingInterface.WithdrawalRequestState state;

    (value, withdrawableFrom, state) = staking.withdrawalRequestInfo(tokenId);

    TokenState tokenState = TokenState.Pending;
    string memory descString = '';
    if (state == CNStakingInterface.WithdrawalRequestState.Unknown) {
      // CnStakingV2 uses block timestamp to determine the state of withdrawal request.
      // So we need to do the same here.
      // slither-disable-next-line timestamp
      if (withdrawableFrom + stakeLockup < block.timestamp) {
        tokenState = TokenState.Expired;
        descString = 'Expired: claiming will re-stake the amount';
        // slither-disable-next-line timestamp
      } else if (withdrawableFrom < block.timestamp) {
        tokenState = TokenState.Claimable;
        descString = 'Valid: Can be claimed';
      } else {
        tokenState = TokenState.Pending;
        descString = 'Pending: cannot be claimed yet';
      }
    } else if (state == CNStakingInterface.WithdrawalRequestState.Transferred) {
      // this is an abnormal situation as token gets burned during withdrawal.
      tokenState = TokenState.Transferred;
      descString = 'Already been claimed';
    } else if (state == CNStakingInterface.WithdrawalRequestState.Cancelled) {
      // this is an abnormal situation as token gets burned during withdrawal.
      tokenState = TokenState.Cancelled;
      descString = 'Cancelled';
    } else {
      revert('Unknown withdrawal request state');
    }

    string memory tokenIdString = Strings.toString(tokenId);
    string memory withdrawableFromString = TimestampStrings.toUTCString(withdrawableFrom);
    string memory expiresAtString = TimestampStrings.toUTCString(withdrawableFrom + stakeLockup);
    string memory valueIntegerString;
    string memory valueDecimalString;
    (valueIntegerString, valueDecimalString) = EtherStrings.toEtherString(value);

    bytes memory svg = abi.encodePacked(
      '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 240 240"><style>@font-face{font-family:M300;src:url(',
      Fonts.MANROPE_300_SUBSET,
      ');}@font-face{font-family:M500;src:url(',
      Fonts.MANROPE_500_SUBSET,
      ');}svg{font:10px M300;fill:#fff;letter-spacing:0.03em;}.large{font-size:20px;}.small{font-size:7px;}.ss{fill:#0d9488;}.bold{font-family:M500;}.condensed{letter-spacing:0.01em;}</style><rect width="100%" height="100%" fill="#080B11"/><rect x="20" y="136" width="200" height="1" fill="white"/><g class="large condensed ss"><rect x="20" y="15" width="200" height="2"/><text x="20" y="46">Unstaking</text><text x="20" y="72">',
      _svgTitle,
      '</text><text x="20" y="98">KLAY #',
      tokenIdString,
      '</text></g>'
    );

    svg = abi.encodePacked(
      svg,
      _tokenStateSVG(tokenState),
      '<g class="bold"><text x="20" y="157">',
      valueIntegerString,
      '</text><text x="196" y="157">KLAY</text></g><text x="20" y="168" class="small" fill="#9fa8b7">',
      valueDecimalString,
      '</text><text x="20" y="201">Claimable from</text><text x="20" y="217" class="bold">',
      withdrawableFromString,
      ' UTC</text></svg>'
    );

    bytes memory json = abi.encodePacked(
      '{"name":"',
      name(),
      ' #',
      tokenIdString,
      '","description":"Claim check for ',
      valueIntegerString,
      valueDecimalString,
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
}
