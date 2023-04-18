// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.19;

import '../ERC20ProgrammaticBalance.sol';

contract ERC20ProgrammaticBalanceMock is ERC20ProgrammaticBalance {
  uint256 private __totalSupply;

  constructor() ERC20ProgrammaticBalance('Test Token', 'TT') {}

  function increaseTotalSupply(uint256 delta) public {
    __totalSupply += delta;
  }

  function _totalSupply() internal view override returns (uint256) {
    return __totalSupply;
  }

  function mintSharesAndAmount(address recipient, uint256 amount) public {
    __totalSupply += amount;
    _mintSharesForAmount(recipient, amount);
  }

  function mintSharesForAmount(
    address recipient,
    uint256 amount,
    uint256 totalSupplyOverride
  ) public {
    _mintSharesForAmount(recipient, amount, totalSupplyOverride);
  }

  function burnAmount(address account, uint256 amount) public {
    __totalSupply -= _burnAmount(account, amount);
  }

  function burnShares(address account, uint256 shares) public {
    __totalSupply -= _burnShares(account, shares);
  }

  function forceTransfer(address sender, address recipient, uint256 amount) public {
    _transfer(sender, recipient, amount);
  }

  function votesCustomBalanceBalanceOf(address account) public view returns (uint256) {
    return _votesCustomBalanceBalanceOf(account);
  }

  function mint(address account, uint256 amount) public pure {
    _mint(account, amount);
  }

  function burn(address account, uint256 amount) public pure {
    _burn(account, amount);
  }
}
