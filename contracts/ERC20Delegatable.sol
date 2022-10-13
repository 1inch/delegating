// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@1inch/solidity-utils/contracts/libraries/AddressSet.sol";

import "./interfaces/IERC20Delegatable.sol";
import "./interfaces/IDelegationTopic.sol";

abstract contract ERC20Delegatable is ERC20, IERC20Delegatable {
    using AddressSet for AddressSet.Data;
    using AddressArray for AddressArray.Data;

    error MaxUserDelegationsReached();
    error ZeroDelegationAddress();
    error SameDelegateeAssigned();
    error DelegationNotExist();

    uint256 private constant _DELEGATE_CALL_GAS_LIMIT = 200_000;

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

    function userDelegations(address account) external view returns(address[] memory) {
        return _userDelegations[account].items.get();
    }

    function delegate(IDelegationTopic delegation, address delegatee) external {
        if (address(delegation) == address(0)) revert ZeroDelegationAddress();
        if (_userDelegations[msg.sender].add(address(delegation))) {
            if (_userDelegations[msg.sender].length() > maxUserDelegations) revert MaxUserDelegationsReached();
        }

        uint256 balance = balanceOf(msg.sender);
        address prevDelegatee = delegation.delegated(msg.sender);
        if (prevDelegatee == delegatee) revert SameDelegateeAssigned();

        if (prevDelegatee != address(0)) {
            delegation.updateBalances(msg.sender, address(0), balance);
        }
        delegation.setDelegate(msg.sender, delegatee);
        delegation.updateBalances(address(0), msg.sender, balance);
    }

    function undelegate(IDelegationTopic delegation) public {
        if (!_userDelegations[msg.sender].remove(address(delegation))) revert DelegationNotExist();
        try delegation.updateBalances{gas: _DELEGATE_CALL_GAS_LIMIT}(msg.sender, address(0), balanceOf(msg.sender)) {} catch {} // solhint-disable-line no-empty-blocks
        try delegation.setDelegate{gas: _DELEGATE_CALL_GAS_LIMIT}(msg.sender, address(0)) {} catch {} // solhint-disable-line no-empty-blocks
    }

    function undelegateAll() external {
        address[] memory delegations = _userDelegations[msg.sender].items.get();
        unchecked {
            for (uint256 i = delegations.length; i > 0; i--) {
                undelegate(IDelegationTopic(delegations[i - 1]));
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
                        try IDelegationTopic(delegation).updateBalances{gas: _DELEGATE_CALL_GAS_LIMIT}(from, to, amount) {} catch {} // solhint-disable-line no-empty-blocks
                        b[j] = address(0);
                        break;
                    }
                }

                if (j == b.length) {
                    // Sender is participating a delegation, but receiver is not
                    try IDelegationTopic(delegation).updateBalances{gas: _DELEGATE_CALL_GAS_LIMIT}(from, address(0), amount) {} catch {} // solhint-disable-line no-empty-blocks
                }
            }

            for (uint256 j = 0; j < b.length; j++) {
                address delegation = b[j];
                if (delegation != address(0)) {
                    // Receiver is participating a delegation, but sender is not
                    try IDelegationTopic(delegation).updateBalances{gas: _DELEGATE_CALL_GAS_LIMIT}(address(0), to, amount) {} catch {} // solhint-disable-line no-empty-blocks
                }
            }
        }
    }
}
