// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@1inch/erc20-pods/contracts/interfaces/IERC20Pods.sol";
import "@1inch/erc20-pods/contracts/Pod.sol";

import "./interfaces/IDelegationPod.sol";

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
                _transfer(prevDelegatee, delegatee, balance);
            }
            emit Delegate(msg.sender, delegatee);
            delegated[msg.sender] = delegatee;
        }
    }

    function updateBalances(address from, address to, uint256 amount) public virtual onlyToken {
        _transfer(delegated[from], delegated[to], amount);
    }

    function _transfer(address prevDelegatee, address delegatee, uint256 balance) internal override virtual {
        if (prevDelegatee != address(0) && delegatee != address(0)) {
            if (prevDelegatee != delegatee) {
                super._transfer(prevDelegatee, delegatee, balance);
            }
        } else if (prevDelegatee != address(0)) {
            _burn(prevDelegatee, balance);
        } else if (delegatee != address(0)) {
            _mint(delegatee, balance);
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
