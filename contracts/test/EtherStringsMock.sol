// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import '../libraries/EtherStrings.sol';

contract EtherStringsMock {
  function toEtherString(uint256 value) external pure returns (string memory, string memory) {
    return EtherStrings.toEtherString(value);
  }
}
