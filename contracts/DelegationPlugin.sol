// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20, ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Plugin } from "@1inch/token-plugins/contracts/Plugin.sol";
import { IERC20Plugins } from "@1inch/token-plugins/contracts/interfaces/IERC20Plugins.sol";
import { IDelegationPlugin } from "./interfaces/IDelegationPlugin.sol";

contract DelegationPlugin is IDelegationPlugin, Plugin, ERC20 {
    error ApproveDisabled();
    error TransferDisabled();

    mapping(address => address) public delegated;

    constructor(string memory name_, string memory symbol_, IERC20Plugins token_)
        ERC20(name_, symbol_) Plugin(token_)
    {}  // solhint-disable-line no-empty-blocks

    function delegate(address delegatee) public virtual {
        address prevDelegatee = delegated[msg.sender];
        if (prevDelegatee != delegatee) {
            delegated[msg.sender] = delegatee;
            emit Delegated(msg.sender, delegatee);
            uint256 balance = IERC20Plugins(TOKEN).pluginBalanceOf(address(this), msg.sender);
            if (balance > 0) {
                _updateBalances(msg.sender, msg.sender, prevDelegatee, delegatee, balance);
            }
        }
    }

    function _updateBalances(address from, address to, uint256 amount) internal override {
        _updateBalances(
            from,
            to,
            from == address(0) ? address(0) : delegated[from],
            to == address(0) ? address(0) : delegated[to],
            amount
        );
    }

    function _updateBalances(address /* from */, address /* to */, address fromDelegatee, address toDelegatee, uint256 amount) internal virtual {
        if (fromDelegatee != toDelegatee && amount > 0) {
            if (fromDelegatee == address(0)) {
                _mint(toDelegatee, amount);
            } else if (toDelegatee == address(0)) {
                _burn(fromDelegatee, amount);
            } else {
                _transfer(fromDelegatee, toDelegatee, amount);
            }
        }
    }

    // ERC20 overrides

    function transfer(address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }

    function approve(address /* spender */, uint256 /* amount */) public pure override(ERC20, IERC20) returns (bool) {
        revert ApproveDisabled();
    }
}
