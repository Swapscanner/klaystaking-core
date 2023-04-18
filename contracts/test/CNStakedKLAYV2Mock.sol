// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import '../CNStakedKLAYV2.sol';

/**
 * @dev We need few extra ability to be enabled for testing.
 *
 * - `receive()` to be able to receive native tokens. Reward will be sent to this contract
 *   without `receive()` being invoked. However there is no easy way for us to send reward
 *   to this contract on test environment without triggering `receive()`.
 */
contract CNStakedKLAYV2Mock is CNStakedKLAYV2 {
  constructor(
    address _feeTo,
    CnStakingV2 _cnStaking
  ) CNStakedKLAYV2('CNStakedKLAYV2Mock', 'msKLAY', _feeTo, _cnStaking) {}

  receive() external payable {}
}
