// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

import '../klaytn/cnstakingv2/CnStakingV2.sol';
import '../CNStakedKLAY.sol';

/**
 * @dev We need few extra ability to be enabled for testing.
 *
 * - `receive()` to be able to receive native tokens. Reward will be sent to this contract
 *   without `receive()` being invoked. However there is no easy way for us to send reward
 *   to this contract on test environment without triggering `receive()`.
 */
contract CNStakedKLAYV1Test is CNStakedKLAY {
  constructor(
    address _feeTo,
    CnStakingContract _cnStaking
  ) CNStakedKLAY(_cnStaking) ProxyStakedKLAY(_feeTo, 'CNStakedKLAYV1', 'sKLAY') {}

  receive() external payable {}
}
