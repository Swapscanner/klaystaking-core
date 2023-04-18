// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import 'hardhat/console.sol';

import '../../ERC20ProgrammaticBalance.sol';

contract E2E_ERC20ProgrammaticBalance is ERC20ProgrammaticBalance {
  address caller = msg.sender;
  uint256 private __totalSupply;

  constructor() ERC20ProgrammaticBalance('Test Token', 'TT') {}

  function increaseTotalSupply(uint256 delta) public {
    __totalSupply += delta;
  }

  function _totalSupply() internal view override returns (uint256) {
    return __totalSupply;
  }

  function mintSharesForAmount(address recipient, uint256 amount) public {
    uint256 previousBalance = balanceOf(recipient);
    uint256 previousShares = sharesOf(recipient);

    __totalSupply += amount;
    _mintSharesForAmount(recipient, amount);

    uint256 newBalance = balanceOf(recipient);
    uint256 newShares = sharesOf(recipient);

    assert(newBalance >= previousBalance);
    assert(newShares > previousShares);
  }

  function mintSharesForAmount(
    address recipient,
    uint256 amount,
    uint256 totalSupplyOverride
  ) public {
    require(totalSupplyOverride <= __totalSupply - amount, 'bad input');

    uint256 previousBalance = balanceOf(recipient);
    uint256 previousShares = sharesOf(recipient);

    __totalSupply += amount;
    _mintSharesForAmount(recipient, amount, totalSupplyOverride);

    uint256 newBalance = balanceOf(recipient);
    uint256 newShares = sharesOf(recipient);

    assert(newBalance >= previousBalance);
    assert(newShares > previousShares);
  }

  function burnAmount(address account, uint256 amount) public {
    uint256 previousBalance = balanceOf(account);
    uint256 previousShares = sharesOf(account);

    _burnAmount(account, amount);

    uint256 newBalance = balanceOf(account);
    uint256 newShares = sharesOf(account);

    assert(newBalance <= previousBalance);
    assert(newShares < previousShares);
  }

  function burnShares(address account, uint256 shares) public {
    uint256 previousBalance = balanceOf(account);
    uint256 previousShares = sharesOf(account);

    _burnShares(account, shares);

    uint256 newBalance = balanceOf(account);
    uint256 newShares = sharesOf(account);

    assert(newBalance <= previousBalance);
    assert(newShares < previousShares);
  }

  function echidna_totalSupply() public view returns (bool) {
    return balanceOf(caller) < totalSupply();
  }

  function echidna_totalShares() public view returns (bool) {
    return sharesOf(caller) < totalShares();
  }
}
