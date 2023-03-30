// SPDX-License-Identifier: MIT
pragma solidity =0.8.18;

import '../libraries/TimestampStrings.sol';

contract TimestampStringsMock {
  function toUTCString(uint256 timestamp) external pure returns (string memory) {
    return TimestampStrings.toUTCString(timestamp);
  }
}
