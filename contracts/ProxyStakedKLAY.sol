// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import 'hardhat/console.sol';

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import './ERC20VotesCustomBalance.sol';
import './ProxyStakedKLAYClaimCheck.sol';

/**
 * @dev Proxy contract for staking KLAY.
 *
 * - NOTE: `value` of `_beforeTokenTransfer(, , value)`, `_afterTokenTransfer(, , value)` will be
 *   passed as `shares` instead of the actual amount of tokens. This is to properly support
 *   checkpoint mechanism of `ERC20Votes`. BEWARE when using other ERC20 extensions that rely on
 *   `value` of `_beforeTokenTransfer(, , value)` and `_afterTokenTransfer(, , value)`.
 *
 * - Unlike above, `value` of `event Transfer(, , value)` will be passed as the actual amount of
 *   tokens.
 */
abstract contract ProxyStakedKLAY is ERC20, ERC20VotesCustomBalance, Ownable {
  error TransferAddressZero();
  error ExcessiveFee();
  error AmountTooSmall();
  error InsufficientBalance();
  error UndefinedFeeTo();
  error AlreadyInitialized();
  error PermissionDenied();
  error InvalidState();

  mapping(address => uint256) public sharesOf;
  uint256 public totalShares;

  ProxyStakedKLAYClaimCheck public claimCheck;

  uint256 public constant PRECISION_MULTIPLIER = 1e27;
  uint256 public constant MAX_FEE_PERCENTAGE = 30;

  address public feeTo;
  uint256 public feeNumerator = 0;
  uint256 public feeDenominator = 1e4;

  event FeeUpdated(
    address indexed previousFeeTo,
    address indexed newFeeTo,
    uint256 previousFeeNumerator,
    uint256 previousFeeDenominator,
    uint256 newFeeNumerator,
    uint256 newFeeDenominator
  );

  uint256 public periodicStakingStatsDebounceInterval = 1 hours;
  uint256 public periodicStakingStatsLastEmittedAt;
  event PeriodicStakingStats(uint256 totalShares, uint256 totalSupply);

  enum WithdrawalRequestState {
    Unknown,
    Transferred,
    Cancelled
  }

  constructor(
    address _feeTo,
    string memory name,
    string memory symbol
  ) ERC20(name, symbol) ERC20Permit(name) Ownable() {
    if (_feeTo == address(0)) revert UndefinedFeeTo();
    feeTo = _feeTo;
  }

  function setClaimCheck(ProxyStakedKLAYClaimCheck newClaimCheck) public onlyOwner {
    if (address(claimCheck) != address(0)) revert AlreadyInitialized();
    claimCheck = newClaimCheck;
  }

  /// virtual functions

  function withdrawalRequestTTL() public view virtual returns (uint256);

  function withdrawalRequestInfo(
    uint256 withdrawalRequestId
  )
    public
    view
    virtual
    returns (uint256 amount, uint256 withdrawableFrom, WithdrawalRequestState state);

  function _nextWithdrawalRequestId() internal virtual returns (uint256);

  function _submitWithdrawalRequest(uint256 amount) internal virtual;

  function _cancelWithdrawal(uint256 withdrawalRequestId) internal virtual;

  function _claimWithdrawal(uint256 withdrawalRequestId) internal virtual;

  function _stake(uint256 amount) internal virtual;

  function _stakedAmount() internal view virtual returns (uint256);

  function _unstakingAmount() internal view virtual returns (uint256);

  /// admin functions

  function setFee(
    address newFeeTo,
    uint256 newFeeNumerator,
    uint256 newFeeDenominator
  ) external onlyOwner {
    if ((100 * newFeeNumerator) / newFeeDenominator > MAX_FEE_PERCENTAGE) revert ExcessiveFee();

    if (newFeeNumerator > 0 && newFeeTo == address(0)) {
      revert UndefinedFeeTo();
    }

    emit FeeUpdated(
      feeTo,
      newFeeTo,
      feeNumerator,
      feeDenominator,
      newFeeNumerator,
      newFeeDenominator
    );

    feeTo = newFeeTo;
    feeNumerator = newFeeNumerator;
    feeDenominator = newFeeDenominator;
  }

  function setPeriodicStakingStatsDebounceInterval(uint256 interval) external onlyOwner {
    periodicStakingStatsDebounceInterval = interval;
  }

  /// implementations

  /**
   * @dev Stakes native tokens to the `cnStaking` and increases their
   * shares accordingly.
   *
   * Emits a {Transfer} event with `from` set to the zero address.
   */
  function stake() external payable {
    _sweepAndStake(_msgSender(), msg.value);
  }

  function stakeFor(address recipient) external payable {
    _sweepAndStake(recipient, msg.value);
  }

  function unstake(uint256 amount) external returns (uint256 tokenId) {
    uint256 balance = balanceOf(_msgSender());
    // slither-disable-next-line incorrect-equality
    return
      _unstakeShares(
        _msgSender(),
        balance == amount ? sharesOf[_msgSender()] : _sharesForNative(amount),
        amount
      );
  }

  function unstakeAll() external returns (uint256 tokenId) {
    uint256 shares = sharesOf[_msgSender()];
    return _unstakeShares(_msgSender(), shares, _nativeForShares(shares));
  }

  function _unstakeShares(
    address account,
    uint256 shares,
    uint256 amount
  ) private returns (uint256 tokenId) {
    if (shares < 1) revert AmountTooSmall();

    _beforeTokenTransfer(account, address(0), shares);

    uint256 currentShares = sharesOf[account];
    if (currentShares < shares) revert InsufficientBalance();
    unchecked {
      sharesOf[account] = currentShares - shares;
      // Overflow not possible: shares <= currentShares <= totalShares
      totalShares -= shares;
    }

    tokenId = _nextWithdrawalRequestId();
    _submitWithdrawalRequest(totalShares == 0 ? _stakedAmount() - _unstakingAmount() : amount);

    claimCheck.mint(account, tokenId);

    // burn
    emit Transfer(account, address(0), amount);

    _afterTokenTransfer(account, address(0), shares);

    _votesCustomBalanceBurn(account, shares);
  }

  function cancel(uint256 claimCheckTokenId) external {
    _cancelWithdrawal(claimCheckTokenId);
    _finalizeWithdrawal(claimCheckTokenId);
  }

  function claim(uint256 claimCheckTokenId) external {
    _claimWithdrawal(claimCheckTokenId);
    _finalizeWithdrawal(claimCheckTokenId);
  }

  function _finalizeWithdrawal(uint256 claimCheckTokenId) private {
    address claimCheckOwner = claimCheck.ownerOf(claimCheckTokenId);
    if (
      _msgSender() != claimCheckOwner &&
      !claimCheck.isApprovedForAll(claimCheckOwner, _msgSender()) &&
      claimCheck.getApproved(claimCheckTokenId) != _msgSender()
    ) revert PermissionDenied();

    uint256 amount;
    WithdrawalRequestState state;
    (amount, , state) = withdrawalRequestInfo(claimCheckTokenId);

    if (state == WithdrawalRequestState.Cancelled) {
      _mintSharesForNativeAmount(claimCheckOwner, amount, amount);
    } else if (state == WithdrawalRequestState.Transferred) {
      // reentrancy is guarded by the _cancelWithdrawal/_claimWithdrawal, which will eventually
      // call CnStakingV2, which will revert on reentrancy.
      // slither-disable-next-line reentrancy-benign
      Address.sendValue(payable(claimCheckOwner), amount);
      sweep();
    } else {
      revert InvalidState();
    }

    claimCheck.burn(claimCheckTokenId);
  }

  /**
   * @dev Sweeps the entire balance of the contract and stakes it.
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
      _mintSharesForNativeAmount(feeTo, feeAmount, feeAmount + amountToBeStaked);
    }

    if (amountToBeStaked > 0) {
      _mintSharesForNativeAmount(stakingRecipient, amountToBeStaked, amountToBeStaked);
    }

    // report stats
    if (
      // timestamp is being used only for reporting purpose
      // slither-disable-next-line timestamp
      periodicStakingStatsLastEmittedAt + periodicStakingStatsDebounceInterval < block.timestamp
    ) {
      periodicStakingStatsLastEmittedAt = block.timestamp;
      emit PeriodicStakingStats(totalShares, totalSupply());
    }
  }

  function _feeAmount(uint256 stakedAmount, uint256 rewardAmount) private view returns (uint256) {
    uint256 rewardForStakedAmount = (
      // edge case: if nobody has staked yet.
      stakedAmount < 1
        ? 0
        : Math.mulDiv(rewardAmount, stakedAmount - _unstakingAmount(), stakedAmount)
    );

    return
      Math.mulDiv(rewardForStakedAmount, feeNumerator, feeDenominator, Math.Rounding.Up) +
      (rewardAmount - rewardForStakedAmount);
  }

  /**
   * @dev Mints corresponding shares for the `recipient` for the `nativeAmount`.
   * Caller must keep track of unminted native amount that are subjected to be minted.
   */
  function _mintSharesForNativeAmount(
    address recipient,
    uint256 nativeAmount,
    uint256 unmintedNativeAmount
  ) private {
    if (recipient == address(0)) revert TransferAddressZero();

    // `shares` must be calculated based on the `totalSupply` subtracted by the
    // amount that are not yet used for minting.
    uint256 shares = _sharesForNativeAndTotalSupply(
      nativeAmount,
      totalSupply() - unmintedNativeAmount
    );
    if (shares < 1) revert AmountTooSmall();

    _beforeTokenTransfer(address(0), recipient, shares);

    totalShares += shares;
    unchecked {
      // Overflow not possible: currentShare + shares is at most totalShares + shares,
      // which is checked above.
      sharesOf[recipient] += shares;
    }

    // mint
    emit Transfer(address(0), recipient, nativeAmount);

    _afterTokenTransfer(address(0), recipient, shares);

    _votesCustomBalanceMint(recipient, shares);
  }

  /// ERC20

  /**
   * @dev See {IERC20-totalSupply}.
   */
  function totalSupply() public view override returns (uint256) {
    uint256 stakedAmount = _stakedAmount();
    uint256 unstakingAmount = _unstakingAmount();
    uint256 rewardAmount = address(this).balance;

    return stakedAmount - unstakingAmount + rewardAmount - _feeAmount(stakedAmount, rewardAmount);
  }

  /**
   * @dev See {IERC20-balanceOf}.
   */
  function balanceOf(address account) public view override returns (uint256) {
    return _nativeForShares(sharesOf[account]);
  }

  /**
   * @dev Moves `amount` of tokens from `from` to `to`.
   *
   * This internal function is equivalent to {transfer}, and can be used to
   * e.g. implement automatic token fees, slashing mechanisms, etc.
   *
   * It transfers `shares` internally, and emits a {Transfer} event with `amount`.
   *
   * Emits a {Transfer} event.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `to` cannot be the zero address.
   * - `from` must have a balance of at least `amount`.
   */
  function _transfer(address from, address to, uint256 amount) internal override {
    if (from == address(0)) revert TransferAddressZero();
    if (to == address(0)) revert TransferAddressZero();

    uint256 fromBalance = sharesOf[from];
    uint256 shares;
    // slither-disable-next-line incorrect-equality
    if (balanceOf(from) == amount) {
      // edge case: if the entire balance is being transferred,
      // the entire shares should be transferred.
      shares = sharesOf[from];
    } else {
      shares = _sharesForNative(amount);
    }

    _beforeTokenTransfer(from, to, shares);

    if (fromBalance < shares) revert InsufficientBalance();
    unchecked {
      sharesOf[from] = fromBalance - shares;
      // Overflow not possible: the sum of all shares is capped by totalShares,
      // and the sum is preserved by decrementing then incrementing.
      sharesOf[to] += shares;
    }

    emit Transfer(from, to, amount);

    _afterTokenTransfer(from, to, shares);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    sweep();
    super._beforeTokenTransfer(from, to, amount);
  }

  function _afterTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override(ERC20, ERC20VotesCustomBalance) {
    super._afterTokenTransfer(from, to, amount);
  }

  /// ERC20VotesCustomBalance

  function _votesCustomBalanceBalanceOf(address account) internal view override returns (uint256) {
    return sharesOf[account];
  }

  function _votesCustomBalanceTotalSupply() internal view override returns (uint256) {
    return totalShares;
  }

  /// private functions

  function _nativeForShares(uint256 shares) private view returns (uint256) {
    return
      totalSupply() < 1 || totalShares < 1
        ? shares / PRECISION_MULTIPLIER
        : Math.mulDiv(totalSupply(), shares, totalShares);
  }

  function _sharesForNativeAndTotalSupply(
    uint256 native,
    uint256 _totalSupply
  ) private view returns (uint256) {
    return
      _totalSupply < 1 || totalShares < 1
        ? native * PRECISION_MULTIPLIER
        : Math.mulDiv(native, totalShares, _totalSupply);
  }

  function _sharesForNative(uint256 native) private view returns (uint256) {
    return _sharesForNativeAndTotalSupply(native, totalSupply());
  }
}
