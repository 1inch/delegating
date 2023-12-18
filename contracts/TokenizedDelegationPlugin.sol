// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20Plugins } from "@1inch/token-plugins/contracts/interfaces/IERC20Plugins.sol";
import { IDelegationPlugin, DelegationPlugin } from "./DelegationPlugin.sol";
import { IDelegatedShare, DelegatedShare } from "./DelegatedShare.sol";
import { ITokenizedDelegationPlugin } from "./interfaces/ITokenizedDelegationPlugin.sol";

contract TokenizedDelegationPlugin is ITokenizedDelegationPlugin, DelegationPlugin {
    error NotRegisteredDelegatee();
    error AlreadyRegistered();

    uint256 public immutable MAX_SHARE_PLUGINS;
    uint256 public immutable SHARE_PLUGIN_GAS_LIMIT;

    mapping(address => IDelegatedShare) public registration;

    modifier onlyRegistered {
        if (address(registration[msg.sender]) == address(0)) revert NotRegisteredDelegatee();
        _;
    }

    modifier onlyNotRegistered {
        if (address(registration[msg.sender]) != address(0)) revert AlreadyRegistered();
        _;
    }

    constructor(string memory name_, string memory symbol_, IERC20Plugins token_, uint256 maxSharePlugins_, uint256 sharePluginGasLimit_) DelegationPlugin(name_, symbol_, token_) {
        MAX_SHARE_PLUGINS = maxSharePlugins_;
        SHARE_PLUGIN_GAS_LIMIT = sharePluginGasLimit_;
    }

    function delegate(address delegatee) public virtual override(IDelegationPlugin, DelegationPlugin) {
        if (delegatee != address(0) && address(registration[delegatee]) == address(0)) revert NotRegisteredDelegatee();
        super.delegate(delegatee);
    }

    function register(string memory name_, string memory symbol_) public virtual onlyNotRegistered returns(IDelegatedShare shareToken) {
        shareToken = new DelegatedShare(name_, symbol_, MAX_SHARE_PLUGINS, SHARE_PLUGIN_GAS_LIMIT);
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
