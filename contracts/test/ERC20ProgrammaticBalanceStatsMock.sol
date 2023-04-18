// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import '../ERC20ProgrammaticBalanceStats.sol';
import './ERC20ProgrammaticBalanceMock.sol';

contract ERC20ProgrammaticBalanceStatsMock is
  ERC20ProgrammaticBalanceStats,
  ERC20ProgrammaticBalanceMock
{
  constructor() ERC20ProgrammaticBalanceMock() {}

  function emitStats() public {
    _emitStats();
  }
}
