// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import './interfaces/IProxyStakedKLAY.sol';
import './FeeCalculator.sol';
import './cnstakinginterfaces/CNStakingInterface.sol';
import './ERC20ProgrammaticBalanceStats.sol';
import './ERC20VotesCustomBalance.sol';
import './ProxyStakedKLAYClaimCheck.sol';

/**
 * @title ProxyStakedKLAY
 * @author Swapscanner
 * @notice This contract manages staked KLAY balances, and distribute rewards to the users.
 *
 * @dev
 *
 * - Reward address should be set to this contract address.
 *
 * - This contract must be registered as an admin for CN staking contract, with quorum of 1.
 *
 * - NOTE: `value` of `_beforeTokenTransfer(, , value)`, `_afterTokenTransfer(, , value)` will be
 *   passed as `shares` instead of the actual amount of tokens. This is to properly support
 *   checkpoint mechanism of `ERC20Votes`. BEWARE when using other ERC20 extensions that rely on
 *   `value` of `_beforeTokenTransfer(, , value)` and `_afterTokenTransfer(, , value)`.
 *
 * - Unlike above, `value` of `event Transfer(, , value)` will be passed as the actual amount of
 *   tokens.
 */
abstract contract ProxyStakedKLAY is
  IProxyStakedKLAY,
  FeeCalculator,
  CNStakingInterface,
  ERC20ProgrammaticBalanceStats,
  Ownable
{
  constructor(
    address _feeTo,
    string memory name,
    string memory symbol
  ) FeeCalculator(_feeTo) ERC20ProgrammaticBalance(name, symbol) Ownable() {}

  /// implementations

  /**
   * @notice Stakes native tokens to the {cnStaking} and increases their shares accordingly.
   *
   * @dev Emits a {Transfer} event with {from} set to the zero address (minting).
   */
  function stake() public payable {
    _sweepAndStake(_msgSender(), msg.value);
  }

  /**
   * @notice Stakes native tokens to the {cnStaking} and increases {recipient}'s shares accordingly.
   *
   * @dev Emits a {Transfer} event with {from} set to the zero address (minting).
   */
  function stakeFor(address recipient) external payable {
    _sweepAndStake(recipient, msg.value);
  }

  /**
   * @notice Sweeps the entire balance of the contract and stakes it as a reward for staked assets.
   * This function assumes that the entire balance is a reward.
   */
  function sweep() public {
    _sweepAndStake(address(0), 0);
  }

  /**
   * @dev Sweeps the entire native token balance of the contract and stakes it.
   * It then settles the fee and staking amount by minting corresponding shares.
   *
   * @param stakingRecipient - The recipient of the staking amount, if any.
   * @param amountToBeStaked - The amount of native token to be staked, if any.
   */
  function _sweepAndStake(address stakingRecipient, uint256 amountToBeStaked) private {
    // _stake() must be called before _mintSharesForNativeAmount() to prevent reentrancy.
    uint256 amountToBeSweeped = address(this).balance;
    if (amountToBeSweeped < 1) return;
    _stake(amountToBeSweeped);

    uint256 feeAmount = _feeAmount(
      _stakedAmount() - amountToBeSweeped,
      amountToBeSweeped - amountToBeStaked
    );
    if (feeAmount > 0) {
      _mintSharesForAmount(feeTo, feeAmount, totalSupply() - feeAmount - amountToBeStaked);
    }

    if (amountToBeStaked > 0) {
      _mintSharesForAmount(stakingRecipient, amountToBeStaked);
    }

    _emitStats();
  }

  /**
   * @dev Calculates the fee amount for the given currently staked amount and reward amount.
   *
   * - If nobody staked, entire reward is considered as fee.
   * - Entire reward for the amount being unstaked is considered as fee.
   * - Fee ratio is applied to the reward for the staked amount.
   */
  function _feeAmount(uint256 stakedAmount, uint256 rewardAmount) private view returns (uint256) {
    uint256 rewardForStakedAmount = (
      // edge case: if nobody has staked yet.
      stakedAmount < 1
        ? 0
        : Math.mulDiv(rewardAmount, stakedAmount - _unstakingAmount(), stakedAmount)
    );

    return _calculateFee(rewardForStakedAmount) + (rewardAmount - rewardForStakedAmount);
  }

  /// required overrides for abstract contracts

  function _totalSupply() internal view override returns (uint256) {
    uint256 stakedAmount = _stakedAmount();
    uint256 unstakingAmount = _unstakingAmount();
    uint256 rewardAmount = address(this).balance;

    return stakedAmount - unstakingAmount + rewardAmount - _feeAmount(stakedAmount, rewardAmount);
  }

  function _transfer(address from, address to, uint256 amount) internal override {
    sweep();
    super._transfer(from, to, amount);
  }

  /// admin functions

  function setFee(
    address newFeeTo,
    uint16 newFeeNumerator,
    uint16 newFeeDenominator
  ) public override onlyOwner {
    super.setFee(newFeeTo, newFeeNumerator, newFeeDenominator);
  }
}
