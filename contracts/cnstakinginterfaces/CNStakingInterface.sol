// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

abstract contract CNStakingInterface {
  enum WithdrawalRequestState {
    Unknown,
    Transferred,
    Cancelled
  }

  function withdrawalRequestTTL() public view virtual returns (uint256);

  function withdrawalRequestInfo(
    uint256 withdrawalRequestId
  )
    public
    view
    virtual
    returns (uint256 amount, uint256 withdrawableFrom, WithdrawalRequestState state);

  function _cnStaking() internal view virtual returns (address);

  function _acceptRewardAddress(address cnStakingAddress) internal virtual;

  function _nextWithdrawalRequestId() internal virtual returns (uint256);

  function _submitWithdrawalRequest(uint256 amount) internal virtual;

  function _cancelWithdrawal(uint256 withdrawalRequestId) internal virtual;

  function _claimWithdrawal(uint256 withdrawalRequestId) internal virtual;

  function _stake(uint256 amount) internal virtual;

  function _stakedAmount() internal view virtual returns (uint256);

  function _unstakingAmount() internal view virtual returns (uint256);
}
