// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import 'hardhat/console.sol';

import '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import '../../external/klaytn/cnstakingv2/CnStakingV2.sol';
import '../../test/CNStakedKLAYV2Mock.sol';
import '../../ProxyStakedKLAYClaimCheck.sol';

contract AbstractAccount {
  function proxy(address target, bytes memory data) external payable returns (bytes memory) {
    (bool success, bytes memory result) = target.call{value: msg.value}(data);
    require(success, 'AbstractAccount: proxy call failed');
    return result;
  }

  receive() external payable {}
}

contract FoundationAdmin is Initializable {
  constructor() {}

  function initialize(CnStakingV2 staking) external initializer {
    staking.setGCId(1);
    staking.reviewInitialConditions();
  }

  receive() external payable {}
}

contract CnStakingV2CanSendKlay is CnStakingV2 {
  constructor(
    address _contractValidator,
    address _nodeId,
    address _rewardAddress,
    address[] memory _cnAdminlist,
    uint256 _requirement,
    uint256[] memory _unlockTime,
    uint256[] memory _unlockAmount
  )
    CnStakingV2(
      _contractValidator,
      _nodeId,
      _rewardAddress,
      _cnAdminlist,
      _requirement,
      _unlockTime,
      _unlockAmount
    )
  {}

  receive() external payable override {}

  function send(address payable recipient, uint256 amount) external returns (bool) {
    (bool success, ) = recipient.call{value: amount}('');
    return success;
  }
}

contract CNAdmin is Initializable {
  CnStakingV2CanSendKlay public immutable cnStaking;

  constructor() {
    FoundationAdmin foundationAdmin = new FoundationAdmin();

    address[] memory cnAdminList = new address[](1);
    cnAdminList[0] = address(this);

    uint256[] memory unlockTime = new uint256[](1);
    unlockTime[0] = block.timestamp + 10;

    uint256[] memory unlockAmount = new uint256[](1);
    unlockAmount[0] = 1;

    cnStaking = new CnStakingV2CanSendKlay(
      address(foundationAdmin),
      address(foundationAdmin),
      address(foundationAdmin),
      cnAdminList,
      1,
      unlockTime,
      unlockAmount
    );

    foundationAdmin.initialize(cnStaking);
    cnStaking.reviewInitialConditions();
  }

  function initialize(address admin) external payable initializer {
    require(msg.value == 1, 'msg.value must be 1');
    cnStaking.depositLockupStakingAndInit{value: 1}();
    cnStaking.submitAddAdmin(admin);
  }

  receive() external payable {}
}

contract E2E {
  CNAdmin public cnAdmin = new CNAdmin();
  AbstractAccount public feeReceiver = new AbstractAccount();
  CNStakedKLAYV2Mock public cnStakedKLAY;
  ProxyStakedKLAYClaimCheck public claimCheck;

  constructor() payable {
    require(msg.value == 1, 'msg.value must be 1');

    cnStakedKLAY = new CNStakedKLAYV2Mock(address(feeReceiver), cnAdmin.cnStaking());

    cnAdmin.initialize{value: 1}(address(cnStakedKLAY));

    claimCheck = new ProxyStakedKLAYClaimCheck(
      cnStakedKLAY,
      'Consensus',
      'Unstaking CNStakedKLAY',
      'usKLAY'
    );

    cnStakedKLAY.setClaimCheck(claimCheck);
    cnStakedKLAY.renounceOwnership();
  }

  function proxy(address target, bytes memory data) public payable returns (bytes memory) {
    (bool success, bytes memory result) = target.call{value: msg.value}(data);
    require(success, 'AbstractAccount: proxy call failed');
    return result;
  }

  receive() external payable {}

  function setFee(address newFeeTo, uint16 newFeeNumerator, uint16 newFeeDenominator) public {
    cnStakedKLAY.setFee(newFeeTo, newFeeNumerator, newFeeDenominator);
  }

  function testTotalShares(address account) public view {
    assert(cnStakedKLAY.sharesOf(account) <= cnStakedKLAY.totalShares());
  }

  function testTotalSupply(address account) public view {
    assert(cnStakedKLAY.balanceOf(account) <= cnStakedKLAY.totalSupply());
  }

  function testIssueReward() public payable {
    (bool success, ) = payable(address(cnAdmin.cnStaking())).call{value: msg.value}('');
    require(success);
    success = cnAdmin.cnStaking().send(payable(address(cnStakedKLAY)), msg.value);
    assert(success);
  }

  function testSweepReward() public {
    uint256 amount = address(cnStakedKLAY).balance;
    uint256 previousCNBalance = address(cnAdmin.cnStaking()).balance;
    uint256 previousTotalSupply = cnStakedKLAY.totalSupply();

    try cnStakedKLAY.sweep() {} catch {
      assert(false);
    }

    uint256 afterCNBalance = address(cnAdmin.cnStaking()).balance;
    uint256 afterTotalSupply = cnStakedKLAY.totalSupply();

    assert(afterTotalSupply >= previousTotalSupply);
    assert(address(cnStakedKLAY).balance == 0);
    assert(afterCNBalance >= previousCNBalance + amount);
  }

  function testStake() public payable {
    uint256 beforeShare = cnStakedKLAY.sharesOf(address(this));
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 amount = msg.value;

    try cnStakedKLAY.stake{value: amount}() {} catch {
      assert(false);
    }

    uint256 afterShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));

    assert(afterBalance >= beforeBalance + amount - 1);
    if (msg.value > 1) {
      assert(afterShare > beforeShare);
    }
  }

  function testStakeWithSweep() public payable {
    cnStakedKLAY.sweep();

    uint256 beforeShare = cnStakedKLAY.sharesOf(address(this));
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 amount = msg.value;
    uint256 beforeTotalShares = cnStakedKLAY.totalShares();
    uint256 beforeTotalSupply = cnStakedKLAY.totalSupply();

    try cnStakedKLAY.stake{value: amount}() {} catch {
      assert(false);
    }

    uint256 afterShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 afterTotalShares = cnStakedKLAY.totalShares();
    uint256 afterTotalSupply = cnStakedKLAY.totalSupply();

    assert(afterBalance >= beforeBalance + amount - 1);
    assert(afterTotalSupply >= beforeTotalSupply + amount - 1);
    if (msg.value > 1) {
      assert(afterShare > beforeShare);
      assert(afterTotalShares > beforeTotalShares);
    } else {
      assert(afterTotalShares >= beforeTotalShares);
    }
  }

  function testStakeFor() public payable {
    uint256 beforeShare = cnStakedKLAY.sharesOf(address(this));
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 amount = msg.value;

    try cnStakedKLAY.stakeFor{value: msg.value}(address(this)) {} catch {
      assert(false);
    }

    uint256 afterShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    assert(afterBalance >= beforeBalance + amount - 1);
    if (msg.value > 1) {
      assert(afterShare > beforeShare);
    }
  }

  function testUnstake(uint256 amount) public {
    uint256 beforeShare = cnStakedKLAY.sharesOf(address(this));
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    require(amount <= beforeBalance, 'amount must be less than balance');
    require(amount > 0, 'amount must be greater than 0');

    try cnStakedKLAY.unstake(amount) {} catch (bytes memory reason) {
      bytes4 desiredSelector = bytes4(keccak256(bytes('AmountTooSmall()')));
      bytes4 receivedSelector = bytes4(reason);
      assert(desiredSelector == receivedSelector);
    }

    uint256 afterShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    assert(afterShare < beforeShare);
    assert(afterBalance <= beforeBalance - amount + 1);
  }

  function testUnstakeWithSweep(uint256 amount) public {
    cnStakedKLAY.sweep();

    uint256 beforeShare = cnStakedKLAY.sharesOf(address(this));
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 beforeTotalShares = cnStakedKLAY.totalShares();
    uint256 beforeTotalSupply = cnStakedKLAY.totalSupply();
    require(amount <= beforeBalance, 'amount must be less than balance');
    require(amount > 0, 'amount must be greater than 0');

    try cnStakedKLAY.unstake(amount) {} catch (bytes memory reason) {
      bytes4 desiredSelector = bytes4(keccak256(bytes('AmountTooSmall()')));
      bytes4 receivedSelector = bytes4(reason);
      assert(desiredSelector == receivedSelector);
    }

    uint256 afterShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 afterTotalShares = cnStakedKLAY.totalShares();
    uint256 afterTotalSupply = cnStakedKLAY.totalSupply();
    assert(afterShare < beforeShare);
    assert(afterBalance <= beforeBalance - amount + 1);
    assert(afterTotalShares < beforeTotalShares);
    assert(afterTotalSupply <= beforeTotalSupply - amount + 1);
  }

  function testUnstakeAll() public {
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    require(beforeBalance > 0, 'balance must be greater than 0');

    try cnStakedKLAY.unstakeAll() {} catch (bytes memory reason) {
      bytes4 desiredSelector = bytes4(keccak256('AmountTooSmall()'));
      bytes4 receivedSelector = bytes4(reason);
      assert(desiredSelector == receivedSelector);
    }

    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 afterShare = cnStakedKLAY.sharesOf(address(this));
    assert(afterBalance == 0);
    assert(afterShare == 0);
  }

  function testTransfer(uint256 amount, address toAccount) public {
    require(address(this) != address(0), 'this must not be 0x0');
    require(toAccount != address(0), 'toAccount must not be 0x0');
    require(toAccount != address(this), 'toAccount must not be this');

    uint256 beforeFromBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 beforeFromShare = cnStakedKLAY.sharesOf(address(this));
    require(amount <= beforeFromBalance, 'amount must be less than balance');
    require(amount > 0, 'amount must be greater than 0');
    uint256 beforeToBalance = cnStakedKLAY.balanceOf(toAccount);
    uint256 beforeToShare = cnStakedKLAY.sharesOf(toAccount);

    try cnStakedKLAY.transfer(toAccount, amount) {} catch (bytes memory reason) {
      bytes4 desiredSelector = bytes4(keccak256('AmountTooSmall()'));
      bytes4 receivedSelector = bytes4(reason);
      assert(desiredSelector == receivedSelector);
    }

    uint256 afterFromBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 afterFromShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterToBalance = cnStakedKLAY.balanceOf(toAccount);
    uint256 afterToShare = cnStakedKLAY.sharesOf(toAccount);

    assert(afterFromBalance <= beforeFromBalance - amount + 1);
    assert(afterFromShare < beforeFromShare);
    assert(afterToBalance >= beforeToBalance + amount - 1);
    assert(afterToShare > beforeToShare);
    if (toAccount == cnStakedKLAY.feeTo()) {
      assert(beforeFromShare + beforeToShare <= afterFromShare + afterToShare);
    } else {
      assert(beforeFromShare + beforeToShare == afterFromShare + afterToShare);
    }
  }

  function testTransferWithSweep(uint256 amount, address toAccount) public {
    require(address(this) != address(0), 'this must not be 0x0');
    require(toAccount != address(0), 'toAccount must not be 0x0');
    require(toAccount != address(this), 'toAccount must not be this');

    // sweep reward to prevent totalShares, totalSupply from being changed
    cnStakedKLAY.sweep();

    uint256 beforeFromBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 beforeFromShare = cnStakedKLAY.sharesOf(address(this));
    require(amount <= beforeFromBalance, 'amount must be less than balance');
    require(amount > 0, 'amount must be greater than 0');
    uint256 beforeToBalance = cnStakedKLAY.balanceOf(toAccount);
    uint256 beforeToShare = cnStakedKLAY.sharesOf(toAccount);
    uint256 beforeTotalShares = cnStakedKLAY.totalShares();
    uint256 beforeTotalSupply = cnStakedKLAY.totalSupply();

    try cnStakedKLAY.transfer(toAccount, amount) {} catch {
      assert(false);
    }

    uint256 afterFromBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 afterFromShare = cnStakedKLAY.sharesOf(address(this));
    uint256 afterToBalance = cnStakedKLAY.balanceOf(toAccount);
    uint256 afterToShare = cnStakedKLAY.sharesOf(toAccount);
    uint256 afterTotalShares = cnStakedKLAY.totalShares();
    uint256 afterTotalSupply = cnStakedKLAY.totalSupply();

    assert(afterFromBalance <= beforeFromBalance - amount + 1);
    assert(afterFromShare < beforeFromShare);
    assert(afterToBalance >= beforeToBalance + amount - 1);
    assert(afterToShare > beforeToShare);
    assert(beforeFromShare + beforeToShare == afterFromShare + afterToShare);
    assert(afterTotalShares == beforeTotalShares);
    assert(afterTotalSupply == beforeTotalSupply);
  }

  function _getRandomTokenId(uint256 input) internal view returns (uint256) {
    uint256 balance = claimCheck.balanceOf(address(this));
    return claimCheck.tokenOfOwnerByIndex(address(this), input % balance);
  }

  function testCancel(uint256 input) public {
    uint256 tokenId = _getRandomTokenId(input);

    uint256 amount;
    ProxyStakedKLAY.WithdrawalRequestState state;
    (, , state) = cnStakedKLAY.withdrawalRequestInfo(tokenId);
    require(state == CNStakingInterface.WithdrawalRequestState.Unknown, 'state must be Unknown');

    uint256 ethBalanceBefore = address(this).balance;
    uint256 tokenBalanceBefore = cnStakedKLAY.balanceOf(address(this));
    uint256 totalSupplyBefore = cnStakedKLAY.totalSupply();
    uint256 shareBefore = cnStakedKLAY.sharesOf(address(this));
    uint256 totalShareBefore = cnStakedKLAY.totalShares();

    cnStakedKLAY.cancel(tokenId);

    (, , state) = cnStakedKLAY.withdrawalRequestInfo(tokenId);
    assert(state == CNStakingInterface.WithdrawalRequestState.Cancelled);

    uint256 ethBalanceAfter = address(this).balance;
    uint256 tokenBalanceAfter = cnStakedKLAY.balanceOf(address(this));
    uint256 totalSupplyAfter = cnStakedKLAY.totalSupply();
    uint256 shareAfter = cnStakedKLAY.sharesOf(address(this));
    uint256 totalShareAfter = cnStakedKLAY.totalShares();

    assert(ethBalanceBefore == ethBalanceAfter);
    assert(tokenBalanceAfter >= tokenBalanceBefore + amount - 1);
    assert(totalSupplyAfter >= totalSupplyBefore + amount - 1);
    assert(shareAfter > shareBefore);
    assert(totalShareAfter > totalShareBefore);
  }

  function testClaim(uint256 input) public {
    uint256 tokenId = _getRandomTokenId(input);

    uint256 amount;
    ProxyStakedKLAY.WithdrawalRequestState state;
    (amount, , state) = cnStakedKLAY.withdrawalRequestInfo(tokenId);
    require(state == CNStakingInterface.WithdrawalRequestState.Unknown, 'state must be Unknown');

    uint256 ethBalanceBefore = address(this).balance;
    uint256 tokenBalanceBefore = cnStakedKLAY.balanceOf(address(this));
    uint256 totalSupplyBefore = cnStakedKLAY.totalSupply();
    uint256 shareBefore = cnStakedKLAY.sharesOf(address(this));
    uint256 totalShareBefore = cnStakedKLAY.totalShares();

    try cnStakedKLAY.claim(tokenId) {} catch Error(string memory reason) {
      bytes32 desiredReason = keccak256('Not withdrawable yet.');
      bytes32 receivedReason = keccak256(bytes(reason));
      assert(desiredReason == receivedReason);
    }

    uint256 ethBalanceAfter = address(this).balance;
    uint256 tokenBalanceAfter = cnStakedKLAY.balanceOf(address(this));
    uint256 totalSupplyAfter = cnStakedKLAY.totalSupply();
    uint256 shareAfter = cnStakedKLAY.sharesOf(address(this));
    uint256 totalShareAfter = cnStakedKLAY.totalShares();

    (amount, , state) = cnStakedKLAY.withdrawalRequestInfo(tokenId);
    if (state == CNStakingInterface.WithdrawalRequestState.Transferred) {
      assert(ethBalanceAfter == ethBalanceBefore + amount);
    } else if (state == CNStakingInterface.WithdrawalRequestState.Cancelled) {
      assert(ethBalanceBefore == ethBalanceAfter);
      assert(tokenBalanceAfter >= tokenBalanceBefore + amount - 1);
      assert(totalSupplyAfter >= totalSupplyBefore + amount - 1);
      assert(shareAfter > shareBefore);
      assert(totalShareAfter > totalShareBefore);
    } else if (state == CNStakingInterface.WithdrawalRequestState.Unknown) {
      assert(ethBalanceBefore == ethBalanceAfter);
      assert(tokenBalanceAfter == tokenBalanceBefore);
      assert(totalSupplyAfter == totalSupplyBefore);
      assert(shareAfter == shareBefore);
      assert(totalShareAfter == totalShareBefore);
    } else {
      assert(false);
    }
  }
}
