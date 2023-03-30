// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '../cnstakinginterfaces/CNStakingInterface.sol';

interface IProxyStakedKLAY {
  error PermissionDenied();
  error InvalidState();

  event PeriodicStakingStats(uint256 totalShares, uint256 totalSupply);

  function stake() external payable;

  function stakeFor(address recipient) external payable;

  function unstake(uint256 amount) external returns (uint256 tokenId);

  function unstakeAll() external returns (uint256 tokenId);

  function cancel(uint256 claimCheckTokenId) external;

  function claim(uint256 claimCheckTokenId) external;

  function sweep() external;
}
