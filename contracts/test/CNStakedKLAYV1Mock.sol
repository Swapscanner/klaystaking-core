// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '../CNStakedKLAYV1.sol';

/**
 * @dev We need few extra ability to be enabled for testing.
 *
 * - `receive()` to be able to receive native tokens. Reward will be sent to this contract
 *   without `receive()` being invoked. However there is no easy way for us to send reward
 *   to this contract on test environment without triggering `receive()`.
 */
contract CNStakedKLAYV1Mock is CNStakedKLAYV1 {
  constructor(
    address _feeTo,
    CnStakingContract _cnStaking
  ) CNStakedKLAYV1('CNStakedKLAYV1Mock', 'msKLAY', _feeTo, _cnStaking) {}
}
