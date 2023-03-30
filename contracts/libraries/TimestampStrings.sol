// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import '../external/BokkyPooBahsDateTimeLibrary.sol';

library TimestampStrings {
  bytes32 private constant _SYMBOLS = '0123456789';

  function toUTCString(uint256 timestamp) internal pure returns (string memory) {
    unchecked {
      uint256 year;
      uint256 month;
      uint256 day;
      uint256 hour;
      uint256 minute;
      uint256 second;

      (year, month, day, hour, minute, second) = BokkyPooBahsDateTimeLibrary.timestampToDateTime(
        timestamp
      );

      bytes memory buffer = new bytes(19);

      // slither-disable-next-line assembly
      assembly {
        mstore8(add(buffer, 32), byte(div(year, 1000), _SYMBOLS))
        mstore8(add(buffer, 33), byte(mod(div(year, 100), 10), _SYMBOLS))
        mstore8(add(buffer, 34), byte(mod(div(year, 10), 10), _SYMBOLS))
        mstore8(add(buffer, 35), byte(mod(year, 10), _SYMBOLS))
        mstore8(add(buffer, 36), 0x2d)
        mstore8(add(buffer, 37), byte(div(month, 10), _SYMBOLS))
        mstore8(add(buffer, 38), byte(mod(month, 10), _SYMBOLS))
        mstore8(add(buffer, 39), 0x2d)
        mstore8(add(buffer, 40), byte(div(day, 10), _SYMBOLS))
        mstore8(add(buffer, 41), byte(mod(day, 10), _SYMBOLS))
        mstore8(add(buffer, 42), 0x20)
        mstore8(add(buffer, 43), byte(div(hour, 10), _SYMBOLS))
        mstore8(add(buffer, 44), byte(mod(hour, 10), _SYMBOLS))
        mstore8(add(buffer, 45), 0x3a)
        mstore8(add(buffer, 46), byte(div(minute, 10), _SYMBOLS))
        mstore8(add(buffer, 47), byte(mod(minute, 10), _SYMBOLS))
        mstore8(add(buffer, 48), 0x3a)
        mstore8(add(buffer, 49), byte(div(second, 10), _SYMBOLS))
        mstore8(add(buffer, 50), byte(mod(second, 10), _SYMBOLS))
      }

      return string(buffer);
    }
  }
}
