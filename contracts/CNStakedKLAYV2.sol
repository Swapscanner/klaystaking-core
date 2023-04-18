// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import './cnstakinginterfaces/CNStakingV2Interface.sol';
import './ProxyStakedKLAYUnstakeable.sol';

/**
 * @title CNStakedKLAYV2
 * @author Swapscanner
 * @dev An entrypoint contract for Swapscanner KLAY staking protocol.
 *
 * This contract is to be used with {CnStakingV2}, an updated version of {CnStakingContract}.
 */
contract CNStakedKLAYV2 is ProxyStakedKLAYUnstakeable, CNStakingV2Interface {
  constructor(
    string memory name,
    string memory symbol,
    address _feeTo,
    CnStakingV2 _cnStaking
  ) CNStakingV2Interface(_cnStaking) ProxyStakedKLAY(_feeTo, name, symbol) {}
}
