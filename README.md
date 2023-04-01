# [<picture><source media="(prefers-color-scheme: dark)" srcset="logo-dark.svg" /><img src="logo-light.svg" alt="Swapscanner" height="40" align="top" /></picture>](https://swapscanner.io) KLAY Staking Protocol

[![Lint](https://github.com/swapscanner/klaystaking-core/actions/workflows/lint.yml/badge.svg)](https://github.com/swapscanner/klaystaking-core/actions/workflows/lint.yml)
[![Test](https://github.com/swapscanner/klaystaking-core/actions/workflows/test.yml/badge.svg)](https://github.com/swapscanner/klaystaking-core/actions/workflows/test.yml)
[![Coverage](https://github.com/swapscanner/klaystaking-core/actions/workflows/coverage.yml/badge.svg)](https://github.com/swapscanner/klaystaking-core/actions/workflows/coverage.yml)
[![Slither](https://github.com/swapscanner/klaystaking-core/actions/workflows/slither.yml/badge.svg)](https://github.com/swapscanner/klaystaking-core/actions/workflows/slither.yml)
[![MythX](https://github.com/swapscanner/klaystaking-core/actions/workflows/mythx.yml/badge.svg)](https://github.com/swapscanner/klaystaking-core/actions/workflows/mythx.yml)
[![codecov](https://codecov.io/github/swapscanner/klaystaking-core/branch/main/graph/badge.svg?token=V4LLJJ86VX)](https://codecov.io/gh/swapscanner/klaystaking-core)

This repository contains the core smart contracts and their tests for [Swapscanner]'s [$KLAY] staking protocol.

The Solidity contracts in this repository are organized into two main contracts, as described in the [Inheritance Structure](#inheritance-structure) section.

The deployment process for these contracts is as follows:

1. The [Klaytn Foundation](https://www.klaytn.foundation) will deploy either [`CnStakingContract`] or [`CnStakingV2`] (collectively referred to as `CNStaking`).
1. Deploy either [`CNStakedKLAYV1`] or [`CNStakedKLAYV2`] (referred to as `CNStakedKLAY`) based on the chosen `CNStaking`.
1. Call `CNStaking.submitAddAdmin(CNStakedKLAY)` to make the deployed `CNStakedKLAY` an admin of `CNStaking`.
1. Set the quorum requirement to `0x1` by calling `CNStaking.submitUpdateRequirement(0x1)`.
1. Update the reward address to `CNStakedKLAY` by calling `CNStaking.submitUpdateRewardAddress(CNStakedKLAY)`.
1. (Optional) Remove other admins one by one.

### Reward Issuance

`CNStakedKLAY` will serve as the (sole) admin of `CNStaking`, responsible for receiving and distributing rewards issued to itself, as well as managing the staked [$KLAY].

Rewards will be automatically issued by increasing the reward address's balance [internally by Klaytn](https://github.com/klaytn/klaytn/blob/243598f312ab6f1fb051c68fcb1ecf90eb842bbe/reward/reward_distributor.go#L111). This process will not invoke the `receive()` fallback function, as Klaytn will only increase the balance.

The `sweep()` function is responsible for receiving and distributing rewards. It will be automatically executed during most operations, including `stake()`, `unstake()`, and `transfer()`. This ensures that rewards are automatically staked and recursively distributed to users based on their "shares".

### Share Issuance and Reward Distribution

When a user stakes their [$KLAY], `CNStakedKLAY` issues "shares". These shares do not directly represent a 1:1 ratio with [$KLAY]. Instead, the entire staked [$KLAY] pool is distributed in proportion to the shares owned by users. This approach enables automated reward distribution as staking rewards are generated.

### Voting with Staked KLAY

There are two distinct voting systems, with one currently in place and the other to be introduced later:

1. [Klaytn Governance Council](https://square.klaytn.foundation) voting (currently in place): In this system, only governance council members, such as [Swapscanner], can cast their votes on proposals.
1. `CNStakedKLAY` voting (to be introduced later): This system, enabled by `CNStakedKLAY` extending [`ERC20Votes`], will allow anyone who has staked their [$KLAY] to participate in voting on proposals.

[Swapscanner], as a member of the Klaytn Governance Council, has the power to vote. However, to promote decentralization, [Swapscanner] plans to base its vote on the outcome of the yet-to-be-implemented `CNStakedKLAY` voting system. This approach will allow users who have staked their KLAY to influence [Swapscanner]'s voting decisions within the Klaytn governance process once the `CNStakedKLAY` voting system is introduced.

## Inheritance Structure

- [`CNStakedKLAYV2`]
  - [`ProxyStakedKLAYUnstakeable`]
    - [`ProxyStakedKLAY`]
      - [`IProxyStakedKLAY`]
      - [`FeeCalculator`]
      - [`CNStakingInterface`]
      - [`Ownable`]
      - [`ERC20ProgrammaticBalanceStats`]
        - [`ERC20ProgrammaticBalance`]
          - [`ERC20VotesCustomBalance`]
            - [`IVotes`]
            - [`ERC20Permit`]
  - [`CNStakingV2Interface`] (or [`CNStakingV1Interface`] for use with [`CnStakingContract`] instead of [`CnStakingV2`])

## Contracts

| Contract Name                         | type                | Feature                                                           |
| ------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| crytic/echidna/\*.sol                 | test                | [Echidna] fuzz tests.                                             |
| test/\*\*/\*.sol                      | test                | Contains mockup contracts for unit and end-to-end tests.          |
| cnstakinginterfaces/\*.sol            | abstract contract   | Contains logic for interacting with `CNStaking`.                  |
| external/\*\*/\*.sol                  | mixed               | External libraries.                                               |
| interfaces/\*.sol                     | interfaces          | Interfaces.                                                       |
| libraries/[`EtherStrings`].sol        | library             | Converts uint256 wei amount to human-friendly ether strings.      |
| libraries/[`Fonts`].sol               | library             | Includes base64 encoded WOFF2 fonts.                              |
| libraries/[`SharesMath`].sol          | library             | Math for share-amount calculation.                                |
| libraries/[`TimestampStrings`].sol    | library             | Converts uint256 timestamp into human-friendly date-time string.  |
| [`CNStakedKLAYV1`]                    | deployable contract | Entrypoint contract for use with [`CnStakingContract`]            |
| [`CNStakedKLAYV2`]                    | deployable contract | Entrypoint contract for use with [`CnStakingV2`]                  |
| [`ERC20ProgrammaticBalance`].sol      | abstract contract   | [`ERC20`] + "share"-based virtual balance management.             |
| [`ERC20ProgrammaticBalanceStats`].sol | abstract contract   | Emit `Stat()` event for APR tracking purpose.                     |
| [`ERC20VotesCustomBalance`].sol       | abstract contract   | [`ERC20Votes`] + [`ERC20ProgrammaticBalance`] support.            |
| [`FeeCalculator`].sol                 | abstract contract   | Manages and calculates fee amounts.                               |
| [`ProxyStakedKLAY`].sol               | abstract contract   | Manages staking.                                                  |
| [`ProxyStakedKLAYClaimCheck`].sol     | deployable contract | NFT ([`ERC721`]) that will be issued for each unstaking requests. |
| [`ProxyStakedKLAYUnstakeable`].sol    | abstract contract   | Unstaking logic for [`ProxyStakedKLAY`].                          |

## Useful yarn scripts

```bash
$ yarn lint
$ yarn test
$ yarn slither
$ yarn echidna:e2e
$ yarn echidna:e2e-erc20-programmatic-balance
$ yarn coverage
$ yarn gas-report
$ yarn compile
$ yarn clean
```

## Security Audits

This project is currently undergoing security auditing. Reports will be available [here](audit/).

## Licenses

The primary license for Swapscanner KLAY Staking is the [GNU General Public License v3.0 or later (GPL-3.0-or-later)](https://spdx.org/licenses/GPL-3.0-or-later.html), see [`LICENSE`]. However, some external files are under different licenses.

- [contracts/external/BokkyPooBahsDateTimeLibrary.sol](contracts/external/BokkyPooBahsDateTimeLibrary.sol) is imported from [here](https://github.com/bokkypoobah/BokkyPooBahsDateTimeLibrary/blob/master/contracts/BokkyPooBahsDateTimeLibrary.sol) and licensed under MIT (as indicated in their SPDX headers).
- [contracts/external/klaytn/cnstaking/\*.sol](contracts/external/klaytn/cnstaking/) are imported from [here](https://github.com/klaytn/klaytn/tree/dev/contracts/cnstaking) and licensed under GNU Lesser General Public License v3.0 (as indicated in their [LICENSE](contracts/external/klaytn/cnstaking/LICENSE)).
- [contracts/external/klaytn/cnstakingv2/\*.sol](contracts/external/klaytn/cnstakingv2/) are imported from [here](https://github.com/klaytn/governance-contracts-audit/tree/main/contracts) and licensed under GNU Lesser General Public License v3.0 only (as indicated in their SPDX headers).

[Swapscanner]: https://swapscanner.io
[$KLAY]: https://swapscanner.io/pro/swap?from=0x754288077d0ff82af7a5317c7cb8c444d421d103&to=0x0000000000000000000000000000000000000000
[Echidna]: https://github.com/crytic/echidna
[`LICENSE`]: LICENSE
[`ERC721`]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/contracts/token/ERC721/ERC721.sol
[`ERC20`]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/contracts/token/ERC20/ERC20.sol
[`ERC20Votes`]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/contracts/token/ERC20/extensions/ERC20Votes.sol
[`Ownable`]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/contracts/access/Ownable.sol
[`IVotes`]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/contracts/governance/utils/IVotes.sol
[`ERC20Permit`]: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.8.2/contracts/token/ERC20/extensions/draft-ERC20Permit.sol
[`CNStakedKLAYV1`]: contracts/CNStakedKLAYV1.sol
[`CNStakedKLAYV2`]: contracts/CNStakedKLAYV2.sol
[`ProxyStakedKLAYUnstakeable`]: contracts/ProxyStakedKLAYUnstakeable.sol
[`ProxyStakedKLAY`]: contracts/ProxyStakedKLAY.sol
[`IProxyStakedKLAY`]: contracts/interfaces/IProxyStakedKLAY.sol
[`FeeCalculator`]: contracts/FeeCalculator.sol
[`CNStakingInterface`]: contracts/cnstakinginterfaces/CNStakingInterface.sol
[`ERC20ProgrammaticBalanceStats`]: contracts/ERC20ProgrammaticBalanceStats.sol
[`ERC20ProgrammaticBalance`]: contracts/ERC20ProgrammaticBalance.sol
[`ERC20VotesCustomBalance`]: contracts/ERC20VotesCustomBalance.sol
[`CNStakingV2Interface`]: contracts/cnstakinginterfaces/CNStakingV2Interface.sol
[`CNStakingV1Interface`]: contracts/cnstakinginterfaces/CNStakingV1Interface.sol
[`CnStakingContract`]: contracts/external/klaytn/cnstaking/CnStakingContract.sol
[`CnStakingV2`]: contracts/external/klaytn/cnstakingv2/CnStakingV2.sol
[`EtherStrings`]: contracts/libraries/EtherStrings.sol
[`Fonts`]: contracts/libraries/Fonts.sol
[`SharesMath`]: contracts/libraries/SharesMath.sol
[`TimestampStrings`]: contracts/libraries/TimestampStrings.sol
[`ProxyStakedKLAYClaimCheck`]: contracts/ProxyStakedKLAYClaimCheck.sol
