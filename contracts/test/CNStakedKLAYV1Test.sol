// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '../cnstakinginterfaces/CNStakingV1Interface.sol';
import '../ProxyStakedKLAYUnstakeable.sol';

/**
 * @dev We need few extra ability to be enabled for testing.
 *
 * - `receive()` to be able to receive native tokens. Reward will be sent to this contract
 *   without `receive()` being invoked. However there is no easy way for us to send reward
 *   to this contract on test environment without triggering `receive()`.
 */
contract CNStakedKLAYV1Test is CNStakingV1Interface, ProxyStakedKLAYUnstakeable {
  constructor(
    address _feeTo,
    CnStakingContract _cnStaking
  ) CNStakingV1Interface(_cnStaking) ProxyStakedKLAY(_feeTo, 'CNStakedKLAYV1', 'sKLAY') {}

  receive() external payable {}
}
