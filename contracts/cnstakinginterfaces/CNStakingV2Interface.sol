// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '../external/klaytn/cnstakingv2/CnStakingV2.sol';
import './CNStakingV1Interface.sol';

/**
 * @dev We need few extra ability to be enabled for testing.
 *
 * - `receive()` to be able to receive native tokens. Reward will be sent to this contract
 *   without `receive()` being invoked. However there is no easy way for us to send reward
 *   to this contract on test environment without triggering `receive()`.
 */
abstract contract CNStakingV2Interface is CNStakingV1Interface {
  constructor(
    CnStakingV2 newCnStaking
  ) CNStakingV1Interface(CnStakingContract(payable(address(newCnStaking)))) {}

  function withdrawalRequestTTL() public view override returns (uint256) {
    return CnStakingV2(payable(address(cnStaking))).STAKE_LOCKUP();
  }

  function _acceptRewardAddress(address cnStakingAddress) internal virtual override {
    CnStakingV2(payable(cnStakingAddress)).acceptRewardAddress(address(this));
  }

  // we do not have to track unstaking amount since CnStakingV2 does it for us.

  function _increaseUnstakingAmount(uint256 amount) internal virtual override {}

  function _decreaseUnstakingAmount(uint256 amount) internal virtual override {}

  function _unstakingAmount() internal view override returns (uint256) {
    return CnStakingV2(payable(address(cnStaking))).unstaking();
  }
}
