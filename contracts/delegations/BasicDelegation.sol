// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IDelegation.sol";

contract BasicDelegation is IDelegation, ERC20, Ownable {
    error MethodDisabled();

    mapping(address => address) public delegated;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function setDelegate(address account, address delegatee) public virtual onlyOwner {
        if (delegatee == address(0)) {
            emit Undelegate(account, delegated[account]);
        } else {
            emit Delegate(account, delegatee);
        }
        delegated[account] = delegatee;
    }

    function updateBalances(address from, address to, uint256 amount) public virtual onlyOwner {
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
