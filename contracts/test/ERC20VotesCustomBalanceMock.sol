// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../ERC20VotesCustomBalance.sol';

contract ERC20VotesCustomBalanceMock is ERC20VotesCustomBalance {
  mapping(address => uint256) private _customBalanceOf;
  uint256 private _customTotalSupply;

  constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {}

  function mint(address account, uint256 amount) public {
    require(account != address(0), 'ERC20: mint to the zero address');

    _beforeTokenTransfer(address(0), account, amount);

    _customTotalSupply += amount;
    unchecked {
      // Overflow not possible: balance + amount is at most totalSupply + amount, which is checked above.
      _customBalanceOf[account] += amount;
    }
    emit Transfer(address(0), account, amount);

    _afterTokenTransfer(address(0), account, amount);

    _votesCustomBalanceMint(account, amount);
  }

  function burn(address account, uint256 amount) public {
    require(account != address(0), 'ERC20: burn from the zero address');

    _beforeTokenTransfer(account, address(0), amount);

    uint256 accountBalance = _customBalanceOf[account];
    require(accountBalance >= amount, 'ERC20: burn amount exceeds balance');
    unchecked {
      _customBalanceOf[account] = accountBalance - amount;
      // Overflow not possible: amount <= accountBalance <= totalSupply.
      _customTotalSupply -= amount;
    }

    emit Transfer(account, address(0), amount);

    _afterTokenTransfer(account, address(0), amount);

    _votesCustomBalanceBurn(account, amount);
  }

  function _transfer(address from, address to, uint256 amount) internal override {
    require(from != address(0), 'ERC20: transfer from the zero address');
    require(to != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(from, to, amount);

    uint256 fromBalance = _customBalanceOf[from];
    require(fromBalance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _customBalanceOf[from] = fromBalance - amount;
      // Overflow not possible: the sum of all balances is capped by totalSupply, and the sum is preserved by
      // decrementing then incrementing.
      _customBalanceOf[to] += amount;
    }

    emit Transfer(from, to, amount);

    _afterTokenTransfer(from, to, amount);
  }

  function getChainId() external view returns (uint256) {
    return block.chainid;
  }

  function setCustomBalanceOf(address account, uint256 amount) external {
    _customBalanceOf[account] = amount;
  }

  function setCustomTotalSupply(uint256 amount) external {
    _customTotalSupply = amount;
  }

  function balanceOf(address account) public view override returns (uint256) {
    return _customBalanceOf[account];
  }

  function totalSupply() public view override returns (uint256) {
    return _customTotalSupply;
  }

  function _votesCustomBalanceBalanceOf(address account) internal view override returns (uint256) {
    return _customBalanceOf[account];
  }

  function _votesCustomBalanceTotalSupply() internal view override returns (uint256) {
    return _customTotalSupply;
  }

  function votesCustomBalanceMint(address account, uint256 amount) external {
    super._votesCustomBalanceMint(account, amount);
  }

  function votesCustomBalanceBurn(address account, uint256 amount) external {
    super._votesCustomBalanceBurn(account, amount);
  }
}
