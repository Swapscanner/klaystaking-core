// SPDX-License-Identifier: MIT
pragma solidity =0.8.18;

import '../libraries/EtherStrings.sol';

contract EtherStringsTest {
  function toEtherString(uint256 value) external pure returns (string memory, string memory) {
    return EtherStrings.toEtherString(value);
  }
}
