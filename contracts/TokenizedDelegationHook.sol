// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20Hooks } from "@1inch/token-hooks/contracts/interfaces/IERC20Hooks.sol";
import { IDelegationHook, DelegationHook } from "./DelegationHook.sol";
import { IDelegatedShare, DelegatedShare } from "./DelegatedShare.sol";
import { ITokenizedDelegationHook } from "./interfaces/ITokenizedDelegationHook.sol";

contract TokenizedDelegationHook is ITokenizedDelegationHook, DelegationHook {
    error NotRegisteredDelegatee();
    error AlreadyRegistered();

    uint256 public immutable MAX_SHARE_HOOKS;
    uint256 public immutable SHARE_HOOK_GAS_LIMIT;

    mapping(address => IDelegatedShare) public registration;

    modifier onlyRegistered {
        if (address(registration[msg.sender]) == address(0)) revert NotRegisteredDelegatee();
        _;
    }

    modifier onlyNotRegistered {
        if (address(registration[msg.sender]) != address(0)) revert AlreadyRegistered();
        _;
    }

    constructor(string memory name_, string memory symbol_, IERC20Hooks token_, uint256 maxShareHooks_, uint256 shareHookGasLimit_) DelegationHook(name_, symbol_, token_) {
        MAX_SHARE_HOOKS = maxShareHooks_;
        SHARE_HOOK_GAS_LIMIT = shareHookGasLimit_;
    }

    function delegate(address delegatee) public virtual override(IDelegationHook, DelegationHook) {
        if (delegatee != address(0) && address(registration[delegatee]) == address(0)) revert NotRegisteredDelegatee();
        super.delegate(delegatee);
    }

    function register(string memory name_, string memory symbol_) public virtual onlyNotRegistered returns(IDelegatedShare shareToken) {
        shareToken = new DelegatedShare(name_, symbol_, MAX_SHARE_HOOKS, SHARE_HOOK_GAS_LIMIT);
        registration[msg.sender] = shareToken;
        emit RegisterDelegatee(msg.sender);
    }

    function _updateBalances(address from, address to, address fromDelegatee, address toDelegatee, uint256 amount) internal virtual override {
        super._updateBalances(from, to, fromDelegatee, toDelegatee, amount);

        if (fromDelegatee != address(0)) {
            registration[fromDelegatee].burn(from, amount);
        }
        if (toDelegatee != address(0)) {
            registration[toDelegatee].mint(to, amount);
        }
    }
}
