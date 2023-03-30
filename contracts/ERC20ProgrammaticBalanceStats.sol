// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import './ERC20ProgrammaticBalance.sol';

/**
 * @title ERC20ProgrammaticBalanceStats
 * @author Swapscanner
 * @notice This contract extends ERC20ProgrammaticBalance to emit stats events.
 *
 * {Stats} event includes the total shares and total supply of the token.
 */
abstract contract ERC20ProgrammaticBalanceStats is ERC20ProgrammaticBalance {
  event Stats(uint256 totalShares, uint256 totalSupply);

  function _emitStats() internal {
    emit Stats(totalShares(), totalSupply());
  }
}
