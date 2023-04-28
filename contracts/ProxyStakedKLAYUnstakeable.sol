// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import './ProxyStakedKLAY.sol';
import './ProxyStakedKLAYClaimCheck.sol';

/**
 * @title ProxyStakedKLAYUnstakeable
 * @author Swapscanner
 * @dev This contract implements unstaking logics for {ProxyStakedKLAY}.
 *
 * Unstaking will mint a {ProxyStakedKLAYClaimCheck} ERC721(NFT) token.
 *
 * Minted {ProxyStakedKLAYClaimCheck} token can be claimed or cancelled through this contract.
 */
abstract contract ProxyStakedKLAYUnstakeable is ProxyStakedKLAY {
  error AlreadyInitialized();

  ProxyStakedKLAYClaimCheck public claimCheck;

  /**
   * @notice Sets the claim check contract.
   *
   * @dev This function can only be called once. It is not in the constructor since
   * we want to deploy the {ProxyStakedKLAYClaimCheck} by the EOA.
   */
  function setClaimCheck(ProxyStakedKLAYClaimCheck newClaimCheck) external onlyOwner {
    if (address(claimCheck) != address(0)) revert AlreadyInitialized();
    claimCheck = newClaimCheck;
  }

  /**
   * @notice Unstakes the given amount of KLAY, staked by the sender, and mints a claim check.
   */
  function unstake(uint256 amount) external returns (uint256 tokenId) {
    sweep();

    return _unstake(_msgSender(), _burnAmount(_msgSender(), amount));
  }

  /**
   * @notice Unstakes all KLAY, staked by the sender, and mints a claim check.
   */
  function unstakeAll() external returns (uint256 tokenId) {
    sweep();

    return _unstake(_msgSender(), _burnShares(_msgSender(), sharesOf(_msgSender())));
  }

  function _unstake(address recipient, uint256 amount) private returns (uint256 tokenId) {
    tokenId = _nextWithdrawalRequestId();

    _submitWithdrawalRequest(totalShares() < 1 ? _stakedAmount() - _unstakingAmount() : amount);

    claimCheck.mint(recipient, tokenId);
  }

  /**
   * @notice Cancels the withdrawal request and mints the staked KLAY back to the sender.
   */
  function cancel(uint256 claimCheckTokenId) external {
    _cancelWithdrawal(claimCheckTokenId);
    _processWithdrawalRequest(claimCheckTokenId);
  }

  /**
   * @notice Claims the withdrawal request and transfers the staked KLAY to the sender.
   *
   * NOTE: Claiming the expired withdrawal request will stake it back to the claim check owner.
   */
  function claim(uint256 claimCheckTokenId) external {
    _claimWithdrawal(claimCheckTokenId);
    _processWithdrawalRequest(claimCheckTokenId);
  }

  function _processWithdrawalRequest(uint256 claimCheckTokenId) private {
    address claimCheckOwner = claimCheck.ownerOf(claimCheckTokenId);
    if (
      _msgSender() != claimCheckOwner &&
      !claimCheck.isApprovedForAll(claimCheckOwner, _msgSender()) &&
      claimCheck.getApproved(claimCheckTokenId) != _msgSender()
    ) revert PermissionDenied();

    claimCheck.burn(claimCheckTokenId);

    uint256 amount;
    WithdrawalRequestState state;
    (amount, , state) = withdrawalRequestInfo(claimCheckTokenId);

    if (state == WithdrawalRequestState.Cancelled) {
      _mintSharesForAmount(claimCheckOwner, amount);
    } else if (state == WithdrawalRequestState.Transferred) {
      // reentrancy is guarded by the _cancelWithdrawal/_claimWithdrawal, which will eventually
      // call CnStakingV2, which will revert on reentrancy.
      // slither-disable-next-line reentrancy-benign
      Address.sendValue(payable(claimCheckOwner), amount);
    } else {
      revert InvalidState();
    }

    sweep();
  }
}
