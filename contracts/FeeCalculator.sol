// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '@openzeppelin/contracts/utils/math/Math.sol';

/**
 * @title FeeCalculator
 * @author Swapscanner
 * @notice This contract implements a fee mechanism for the staking protocol.
 *
 * Emits a {FeeUpdated} event when the fee is updated.
 *
 * @dev Features:
 *
 * - Maximum fee is hard capped at 30% and never ever cannot be overriden.
 */
abstract contract FeeCalculator {
  error ExcessiveFee();
  error UndefinedFeeTo();

  event FeeUpdated(
    address indexed previousFeeTo,
    address indexed newFeeTo,
    uint16 previousFeeNumerator,
    uint16 previousFeeDenominator,
    uint16 newFeeNumerator,
    uint16 newFeeDenominator
  );

  uint16 public constant MAX_FEE_PERCENTAGE = 30;

  address public feeTo;
  uint16 public feeNumerator = 0;
  uint16 public feeDenominator = 1e4;

  constructor(address newFeeTo) {
    if (newFeeTo == address(0)) revert UndefinedFeeTo();
    feeTo = newFeeTo;
  }

  function setFee(
    address newFeeTo,
    uint16 newFeeNumerator,
    uint16 newFeeDenominator
  ) public virtual {
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

  function _calculateFee(uint256 amount) internal view returns (uint256 fee) {
    return Math.mulDiv(amount, feeNumerator, feeDenominator);
  }
}
