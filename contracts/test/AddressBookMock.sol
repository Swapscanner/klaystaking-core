// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import '../external/klaytn/cnstakingv2/CnStakingV2.sol';

contract AddressBookMock is IAddressBook {
  event ReviseRewardAddress(address a);

  function getState() external pure returns (address[] memory, uint256) {
    return (new address[](0), 0);
  }

  function reviseRewardAddress(address a) external {
    emit ReviseRewardAddress(a);
  }
}
