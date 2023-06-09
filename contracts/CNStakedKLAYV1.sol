// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import './cnstakinginterfaces/CNStakingV1Interface.sol';
import './ProxyStakedKLAYUnstakeable.sol';

/**
 * @title CNStakedKLAYV1
 * @author Swapscanner
 * @dev An entrypoint contract for Swapscanner KLAY staking protocol.
 *
 * This contract is to be used with {CnStakingContract}.
 */
contract CNStakedKLAYV1 is ProxyStakedKLAYUnstakeable, CNStakingV1Interface {
  constructor(
    string memory name,
    string memory symbol,
    address _feeTo,
    CnStakingContract newCnStaking
  ) CNStakingV1Interface(newCnStaking) ProxyStakedKLAY(_feeTo, name, symbol) {}
}
