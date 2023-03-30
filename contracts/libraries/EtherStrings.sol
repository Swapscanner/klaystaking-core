// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library EtherStrings {
  bytes32 private constant _SYMBOLS = '0123456789';
  uint64 private constant _1_ETHER = 1 ether;

  /**
   * @dev Return the log in base 10, rounded down, of a positive value.
   * Returns 0 if given 0.
   */
  function log10(uint256 value) internal pure returns (uint8) {
    uint8 result = 0;
    unchecked {
      if (value >= 10 ** 64) {
        value /= 10 ** 64;
        result += 64;
      }
      if (value >= 10 ** 32) {
        value /= 10 ** 32;
        result += 32;
      }
      if (value >= 10 ** 16) {
        value /= 10 ** 16;
        result += 16;
      }
      if (value >= 10 ** 8) {
        value /= 10 ** 8;
        result += 8;
      }
      if (value >= 10 ** 4) {
        value /= 10 ** 4;
        result += 4;
      }
      if (value >= 10 ** 2) {
        value /= 10 ** 2;
        result += 2;
      }
      if (value >= 10 ** 1) {
        result += 1;
      }
    }
    return result;
  }

  function _integerPartOf(uint256 value) private pure returns (string memory) {
    unchecked {
      uint256 ethValue = value / 1 ether;

      uint8 length = log10(ethValue) + 1;
      uint8 commaCount = (length - 1) / 3;
      uint8 bufferLength = length + commaCount;
      commaCount = 0;

      bytes memory buffer = new bytes(bufferLength);

      uint256 ptr;
      // slither-disable-next-line assembly
      assembly {
        ptr := add(buffer, add(32, bufferLength))
      }
      while (true) {
        ptr--;
        // slither-disable-next-line assembly
        assembly {
          mstore8(ptr, byte(mod(ethValue, 10), _SYMBOLS))
        }
        ethValue /= 10;
        if (ethValue == 0) break;
        // slither-disable-next-line assembly
        assembly {
          commaCount := addmod(commaCount, 1, 3)
        }
        if (commaCount == 0) {
          ptr--;
          // prepending the comma ","
          // slither-disable-next-line assembly
          assembly {
            mstore8(ptr, 44)
          }
        }
      }

      return string(buffer);
    }
  }

  function _decimalPartOf(uint256 value) private pure returns (string memory) {
    unchecked {
      uint64 ethDecimal;
      // get decimal parts
      // slither-disable-next-line assembly
      assembly {
        ethDecimal := mod(value, _1_ETHER)
      }
      if (ethDecimal == 0) {
        return '';
      }

      bytes memory buffer = new bytes(19);

      uint256 ptr;
      // slither-disable-next-line assembly
      assembly {
        ptr := add(buffer, 51)
      }
      for (uint8 i = 0; i < 18; i += 1) {
        ptr--;
        // prepending the digits
        // slither-disable-next-line assembly
        assembly {
          mstore8(ptr, byte(mod(ethDecimal, 10), _SYMBOLS))
        }
        if (ethDecimal > 0) {
          ethDecimal /= 10;
        }
      }

      // prepending the dot "."
      // slither-disable-next-line assembly
      assembly {
        mstore8(sub(ptr, 1), 46)
      }

      return string(buffer);
    }
  }

  function toEtherString(
    uint256 value
  ) internal pure returns (string memory integerPart, string memory decimalPart) {
    unchecked {
      return (_integerPartOf(value), _decimalPartOf(value));
    }
  }
}
