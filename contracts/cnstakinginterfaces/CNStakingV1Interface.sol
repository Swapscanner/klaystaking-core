// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '../external/klaytn/cnstaking/CnStakingContract.sol';
import './CNStakingInterface.sol';

/**
 * @dev
 *
 * Migration plan for `-> CNStakedKLAY(CnStakingContract)`:
 * 1. Call CnStakingContract.submitUpdateRequirement(1)
 * 1. Call CnStakingContract.submitApproveStakingWithdrawal(ADMIN, CnStakingContract.staking())
 * 1. Wait for CnStakingContract.ONE_WEEK()
 * 1. Call CnStakingContract.withdrawStaking()
 * 1. Within Klaytn block snapshot period:
 *   1. Deploy cn1 = CNStakedKLAY(CnStakingContract)
 *   1. Call CnStakingContract.submitAddAdmin(cn1.address)
 *   1. Call CnStakingContract.submitUpdateRewardAddress(cn1.address)
 *   1. Call cn1.stake()
 *
 * Migration plan for `CNStakedKLAY(CnStakingContract) -> CNStakedKLAY(CnStakingV2)`:
 * 1. Call CnStakingV2.submitUpdateRequirement(1)
 * 1. Call cn1.unstakeAll()
 * 1. Wait for CnStakingContract.ONE_WEEK()
 * 1. Call cn1.claim()
 * 1. Within Klaytn block snapshot period
 *   1. Deploy cn2 = CNStakedKLAY(CnStakingV2)
 *   1. Call CnStakingV2.submitAddAdmin(cn2.address)
 *   1. Call CnStakingV2.submitUpdateRewardAddress(cn2.address)
 *   1. Call cn2.stake()
 */
abstract contract CNStakingV1Interface is CNStakingInterface {
  CnStakingContract public immutable cnStaking;
  uint256 private _unstaking;

  constructor(CnStakingContract _cnStaking) {
    cnStaking = _cnStaking;
  }

  function withdrawalRequestTTL() public view virtual override returns (uint256) {
    return cnStaking.ONE_WEEK();
  }

  function withdrawalRequestInfo(
    uint256 withdrawalRequestId
  )
    public
    view
    virtual
    override
    returns (uint256 amount, uint256 withdrawableFrom, WithdrawalRequestState state)
  {
    CnStakingContract.WithdrawalStakingState _state;
    (, amount, withdrawableFrom, _state) = cnStaking.getApprovedStakingWithdrawalInfo(
      withdrawalRequestId
    );

    if (_state == CnStakingContract.WithdrawalStakingState.Unknown) {
      state = WithdrawalRequestState.Unknown;
    } else if (_state == CnStakingContract.WithdrawalStakingState.Transferred) {
      state = WithdrawalRequestState.Transferred;
    } else if (_state == CnStakingContract.WithdrawalStakingState.Canceled) {
      state = WithdrawalRequestState.Cancelled;
    }
  }

  function _nextWithdrawalRequestId() internal view virtual override returns (uint256) {
    return cnStaking.withdrawalRequestCount();
  }

  function _increaseUnstakingAmount(uint256 amount) internal virtual {
    _unstaking += amount;
  }

  function _decreaseUnstakingAmount(uint256 amount) internal virtual {
    _unstaking -= amount;
  }

  function _submitWithdrawalRequest(uint256 amount) internal virtual override {
    _increaseUnstakingAmount(amount);

    cnStaking.submitApproveStakingWithdrawal(address(this), amount);
  }

  function _cancelWithdrawal(uint256 withdrawalRequestId) internal virtual override {
    uint256 amount;
    (amount, , ) = withdrawalRequestInfo(withdrawalRequestId);
    _decreaseUnstakingAmount(amount);

    cnStaking.submitCancelApprovedStakingWithdrawal(withdrawalRequestId);
  }

  function _claimWithdrawal(uint256 withdrawalRequestId) internal virtual override {
    uint256 amount;
    (amount, , ) = withdrawalRequestInfo(withdrawalRequestId);
    _decreaseUnstakingAmount(amount);

    cnStaking.withdrawApprovedStaking(withdrawalRequestId);
  }

  function _stake(uint256 amount) internal virtual override {
    // slither-disable-next-line arbitrary-send-eth
    cnStaking.stakeKlay{value: amount}();
  }

  function _stakedAmount() internal view virtual override returns (uint256) {
    return cnStaking.staking();
  }

  function _unstakingAmount() internal view virtual override returns (uint256 unstakingAmount) {
    /*
    // Following code could be more accurate,
    // but it is too expensive to call due to unbound loop.
    // Therefore, we use the cached value `_unstaking` instead.
    // That means, no-one should directly interact with CnStakingContract.

    uint256 lockupPeriod = withdrawalRequestTTL();

    uint256 amount;
    uint256 withdrawableFrom;
    CnStakingContract.WithdrawalStakingState _state;

    for (uint256 i = _nextWithdrawalRequestId(); i > 0; ) {
      unchecked {
        --i;
      }

      (, amount, withdrawableFrom, _state) = cnStaking.getApprovedStakingWithdrawalInfo(i);

      if (_state != CnStakingContract.WithdrawalStakingState.Unknown) {
        continue;
      }

      if (withdrawableFrom + lockupPeriod < block.timestamp) {
        break;
      }

      unstakingAmount += amount;
    }
    */
    return _unstaking;
  }
}
