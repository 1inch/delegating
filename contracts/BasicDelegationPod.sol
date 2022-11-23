// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@1inch/erc20-pods/contracts/interfaces/IERC20Pods.sol";
import "@1inch/erc20-pods/contracts/Pod.sol";

import "./interfaces/IDelegationPod.sol";

contract BasicDelegationPod is IDelegationPod, Pod, ERC20 {
    error ApproveDisabled();
    error TransferDisabled();

    mapping(address => address) public delegated;

    constructor(string memory name_, string memory symbol_, address token)
        ERC20(name_, symbol_) Pod(token)
    {}  // solhint-disable-line no-empty-blocks

    function delegate(address delegatee) public virtual {
        address prevDelegatee = delegated[msg.sender];
        if (prevDelegatee != delegatee) {
            delegated[msg.sender] = delegatee;
            emit Delegated(msg.sender, delegatee);
            uint256 balance = IERC20Pods(token).podBalanceOf(address(this), msg.sender);
            if (balance > 0) {
                _transfer(prevDelegatee, delegatee, balance);
            }
        }
    }

    function updateBalances(address from, address to, uint256 amount) public virtual onlyToken {
        _transfer(
            from == address(0) ? address(0) : delegated[from],
            to == address(0) ? address(0) : delegated[to],
            amount
        );
    }

    function _transfer(address from, address to, uint256 amount) internal override virtual {
        if (from != to && amount > 0) {
            if (from == address(0)) {
                _mint(to, amount);
            } else if (to == address(0)) {
                _burn(from, amount);
            } else {
                super._transfer(from, to, amount);
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

    function increaseAllowance(address /* spender */, uint256 /* addedValue */) public pure override returns (bool) {
        revert ApproveDisabled();
    }

    function decreaseAllowance(address /* spender */, uint256 /* subtractedValue */) public pure override returns (bool) {
        revert ApproveDisabled();
    }
}
