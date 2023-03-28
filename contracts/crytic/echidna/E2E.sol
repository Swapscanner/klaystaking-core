// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.18;

import 'hardhat/console.sol';
import '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import '../..//klaytn/cnstakingv2/CnStakingV2.sol';
import '../../test/CNStakedKLAYV2Test.sol';
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

contract CNAdmin is Initializable {
  CnStakingV2 public immutable cnStaking;

  constructor() {
    FoundationAdmin foundationAdmin = new FoundationAdmin();

    address[] memory cnAdminList = new address[](1);
    cnAdminList[0] = address(this);

    uint256[] memory unlockTime = new uint256[](1);
    unlockTime[0] = block.timestamp + 10;

    uint256[] memory unlockAmount = new uint256[](1);
    unlockAmount[0] = 1;

    cnStaking = new CnStakingV2(
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
  CNStakedKLAYV2Test public cnStakedKLAY;
  ProxyStakedKLAYClaimCheck public claimCheck;

  address _onReceiveTarget;
  bytes _onReceiveData;

  constructor() payable {
    require(msg.value == 1, 'msg.value must be 1');
    cnAdmin.initialize{value: 1}(address(this));

    cnStakedKLAY = new CNStakedKLAYV2Test(
      address(feeReceiver),
      CnStakingContract(payable(address(cnAdmin.cnStaking())))
    );

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

  function setOnReceive(address target, bytes memory data) external {
    _onReceiveTarget = target;
    _onReceiveData = data;
  }

  receive() external payable {
    if (_onReceiveTarget != address(0)) {
      proxy(_onReceiveTarget, _onReceiveData);
    }
  }

  function testTotalShares(address account) public view {
    assert(cnStakedKLAY.sharesOf(account) <= cnStakedKLAY.totalShares());
  }

  function testTotalSupply(address account) public view {
    assert(cnStakedKLAY.balanceOf(account) <= cnStakedKLAY.totalSupply());
  }

  function testIssueReward() public payable {
    (bool sent, ) = payable(cnStakedKLAY).call{value: msg.value}('');
    assert(sent);
  }

  function testSweepReward() public {
    uint256 amount = address(cnStakedKLAY).balance;
    uint256 previousCNBalance = address(cnAdmin.cnStaking()).balance;
    uint256 previousTotalSupply = cnStakedKLAY.totalSupply();

    cnStakedKLAY.sweep();

    uint256 afterCNBalance = address(cnAdmin.cnStaking()).balance;
    uint256 afterTotalSupply = cnStakedKLAY.totalSupply();

    assert(afterTotalSupply >= previousTotalSupply);
    assert(address(cnStakedKLAY).balance == 0);
    assert(afterCNBalance >= previousCNBalance + amount);
  }

  function testStake() public payable {
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    uint256 amount = msg.value;
    cnStakedKLAY.stake{value: amount}();
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    assert(afterBalance >= beforeBalance + amount - 1);
  }

  function testStakeFor() public payable {
    uint256 beforeBalance = cnStakedKLAY.balanceOf(msg.sender);
    uint256 amount = msg.value;
    cnStakedKLAY.stakeFor{value: msg.value}(msg.sender);
    uint256 afterBalance = cnStakedKLAY.balanceOf(msg.sender);
    assert(afterBalance >= beforeBalance + amount - 1);
  }

  function testUnstake(uint256 amount) public {
    uint256 beforeBalance = cnStakedKLAY.balanceOf(address(this));
    require(amount <= beforeBalance, 'amount must be less than balance');
    cnStakedKLAY.unstake(amount);
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    assert(afterBalance < beforeBalance);
  }

  function testUnstakeAll() public {
    cnStakedKLAY.unstakeAll();
    uint256 afterBalance = cnStakedKLAY.balanceOf(address(this));
    assert(afterBalance == 0);
  }

  function testCancel(uint256 tokenId) public {
    uint256 tokenBalanceBefore = cnStakedKLAY.balanceOf(address(this));
    uint256 totalSupplyBefore = cnStakedKLAY.totalSupply();
    uint256 shareBefore = cnStakedKLAY.sharesOf(address(this));
    uint256 totalShareBefore = cnStakedKLAY.totalShares();

    cnStakedKLAY.cancel(tokenId);

    uint256 amount;
    ProxyStakedKLAY.WithdrawalRequestState state;
    (, , state) = cnStakedKLAY.withdrawalRequestInfo(tokenId);
    assert(state == ProxyStakedKLAY.WithdrawalRequestState.Cancelled);

    uint256 tokenBalanceAfter = cnStakedKLAY.balanceOf(address(this));
    uint256 totalSupplyAfter = cnStakedKLAY.totalSupply();
    uint256 shareAfter = cnStakedKLAY.sharesOf(address(this));
    uint256 totalShareAfter = cnStakedKLAY.totalShares();

    assert(tokenBalanceAfter >= tokenBalanceBefore + amount - 1);
    assert(totalSupplyAfter >= totalSupplyBefore + amount - 1);
    assert(shareAfter > shareBefore);
    assert(totalShareAfter > totalShareBefore);
  }

  function testClaim(uint256 tokenId) public {
    uint256 balanceBefore = address(this).balance;

    cnStakedKLAY.claim(tokenId);

    uint256 amount;
    ProxyStakedKLAY.WithdrawalRequestState state;
    (amount, , state) = cnStakedKLAY.withdrawalRequestInfo(tokenId);
    assert(state == ProxyStakedKLAY.WithdrawalRequestState.Cancelled);

    uint256 balanceAfter = address(this).balance;

    assert(balanceAfter == balanceBefore + amount);
  }
}
