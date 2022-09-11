// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressSet.sol";

import "./interfaces/IERC20Delegatable.sol";
import "./interfaces/IDelegation.sol";

abstract contract ERC20Delegatable is ERC20, IERC20Delegatable {
    using AddressSet for AddressSet.Data;
    using AddressArray for AddressArray.Data;

    error MaxUserDelegationsReached();
    error ZeroDelegationAddress();
    error SameDelegateeAssigned();
    error DelegationNotExist();

    uint256 public immutable maxUserDelegations;

    mapping(address => AddressSet.Data) private _userDelegations;

    constructor(uint256 maxUserDelegations_) {
        maxUserDelegations = maxUserDelegations_;
    }

    function userIsDelegating(address account, address delegation) external view returns(bool) {
        return _userDelegations[account].contains(delegation);
    }

    function userDelegationsCount(address account) external view returns(uint256) {
        return _userDelegations[account].length();
    }

    function userDelegationsAt(address account, uint256 index) external view returns(address) {
        return _userDelegations[account].at(index);
    }

    function userDelegations(address account) public view virtual returns(address[] memory) {
        return _userDelegations[account].items.get();
    }

    function delegate(IDelegation delegation, address delegatee) external {
        _userDelegations[msg.sender].add(address(delegation));
        if (_userDelegations[msg.sender].length() > maxUserDelegations) revert MaxUserDelegationsReached();
        if (address(delegation) == address(0)) revert ZeroDelegationAddress();

        address prevDelegatee;
        try delegation.delegated{gas:200_000}(msg.sender) returns(address prevDelegatee_) {
            prevDelegatee = prevDelegatee_;
        } catch {}
        if (prevDelegatee == delegatee) revert SameDelegateeAssigned();
        if (prevDelegatee != address(0)) {
            try delegation.updateBalances{gas:200_000}(msg.sender, address(0), balanceOf(msg.sender)) {} catch {}
        }

        try delegation.setDelegate{gas:200_000}(msg.sender, delegatee) {} catch {}
        try delegation.updateBalances{gas:200_000}(address(0), msg.sender, balanceOf(msg.sender)) {} catch {}
    }

    function undelegate(IDelegation delegation) public {
        if (!_userDelegations[msg.sender].remove(address(delegation))) revert DelegationNotExist();
        try delegation.updateBalances{gas:200_000}(msg.sender, address(0), balanceOf(msg.sender)) {} catch {}
        try delegation.setDelegate{gas:200_000}(msg.sender, address(0)) {} catch {}
    }

    function undelegateAll() external {
        address[] memory delegations = _userDelegations[msg.sender].items.get();
        unchecked {
            for (uint256 i = delegations.length; i > 0; i--) {
                undelegate(IDelegation(delegations[i - 1]));
            }
        }
    }

    // ERC20 overrides

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override virtual {
        super._beforeTokenTransfer(from, to, amount);

        if (amount > 0 && from != to) {
            address[] memory a = _userDelegations[from].items.get();
            address[] memory b = _userDelegations[to].items.get();

            for (uint256 i = 0; i < a.length; i++) {
                address delegation = a[i];

                uint256 j;
                for (j = 0; j < b.length; j++) {
                    if (delegation == b[j]) {
                        // Both parties are participating the same delegation
                        try IDelegation(delegation).updateBalances{gas:200_000}(from, to, amount) {} catch {}
                        b[j] = address(0);
                        break;
                    }
                }

                if (j == b.length) {
                    // Sender is participating a delegation, but receiver is not
                    try IDelegation(delegation).updateBalances{gas:200_000}(from, address(0), amount) {} catch {}
                }
            }

            for (uint256 j = 0; j < b.length; j++) {
                address delegation = b[j];
                if (delegation != address(0)) {
                    // Receiver is participating a delegation, but sender is not
                    try IDelegation(delegation).updateBalances{gas:200_000}(address(0), to, amount) {} catch {}
                }
            }
        }
    }
}
