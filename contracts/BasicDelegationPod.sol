// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@1inch/erc20-pods/contracts/interfaces/IERC20Pods.sol";
import "@1inch/erc20-pods/contracts/Pod.sol";

import "./interfaces/IDelegationPod.sol";

/// @dev owner of BasicDelegationPod should be set to ERC20Delegatable contract
contract BasicDelegationPod is IDelegationPod, Pod, ERC20 {
    error MethodDisabled();

    mapping(address => address) public delegated;

    constructor(string memory name_, string memory symbol_, address token)
        ERC20(name_, symbol_) Pod(token)
    {}  // solhint-disable-line no-empty-blocks

    function delegate(address delegatee) public virtual {
        address prevDelegatee = delegated[msg.sender];
        if (prevDelegatee != delegatee) {
            uint256 balance = IERC20Pods(token).podBalanceOf(address(this), msg.sender);
            if (balance > 0) {
                _burn(prevDelegatee, balance);
                _mint(delegatee, balance);
            }
            emit Delegate(msg.sender, delegatee);
            delegated[msg.sender] = delegatee;
        }
    }

    function updateBalances(address from, address to, uint256 amount) public virtual onlyToken {
        if (from == address(0)) {
            _mint(delegated[to], amount);
            return;
        }

        if (to == address(0)) {
            _burn(delegated[from], amount);
            return;
        }

        address fromDelegatee = delegated[from];
        address toDelegatee = delegated[to];
        if (fromDelegatee != toDelegatee) {
            _burn(fromDelegatee, amount);
            _mint(toDelegatee, amount);
        }
    }

    // ERC20 overrides

    function _mint(address account, uint256 amount) internal virtual override {
        if (account != address(0)) {
            super._mint(account, amount);
        }
    }

    function _burn(address account, uint256 amount) internal virtual override {
        if (account != address(0)) {
            super._burn(account, amount);
        }
    }

    function transfer(address /* to */, uint256 /* amount */) public virtual override(IERC20, ERC20) returns (bool) {
        revert MethodDisabled();
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public virtual override(IERC20, ERC20) returns (bool) {
        revert MethodDisabled();
    }

    function approve(address /* spender */, uint256 /* amount */) public virtual override(IERC20, ERC20) returns (bool) {
        revert MethodDisabled();
    }
}
