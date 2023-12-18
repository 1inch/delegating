// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20, ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Plugins } from "@1inch/token-plugins/contracts/ERC20Plugins.sol";
import { IDelegatedShare } from "./interfaces/IDelegatedShare.sol";

/// @title DelegatedShare
/// @dev DelegatedShare is a specialized version of an ERC20 token with additional functionalities.
contract DelegatedShare is IDelegatedShare, ERC20Plugins {
    error ApproveDisabled();
    error TransferDisabled();
    error NotOwnerPlugin();

    /// @notice The address of the owner plugin.
    address immutable public OWNER_PLUGIN;

    /// @dev Throws if called by any account other than the ownerPlugin.
    modifier onlyOwnerPlugin {
        if (msg.sender != OWNER_PLUGIN) revert NotOwnerPlugin();
        _;
    }

    /// @param name_ The name of the token.
    /// @param symbol_ The symbol of the token.
    /// @param maxUserPlugins_ The maximum number of user plugins.
    /// @param pluginCallGasLimit_ The gas limit for plugin calls.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxUserPlugins_,
        uint256 pluginCallGasLimit_
    ) ERC20(name_, symbol_) ERC20Plugins(maxUserPlugins_, pluginCallGasLimit_) {
        OWNER_PLUGIN = msg.sender;
    }

    /// @notice Add default farm for an account if it doesn't exist.
    /// @dev Only callable by the owner plugin.
    /// @param account The account to add default farm for.
    /// @param farm The farm to add.
    function addDefaultFarmIfNeeded(address account, address farm) external onlyOwnerPlugin {
        if (!hasPlugin(account, farm)) {
            _addPlugin(account, farm);
        }
    }

    /// @notice Mint tokens.
    /// @dev Only callable by the owner plugin.
    /// @param account The address to mint tokens to.
    /// @param amount The amount of tokens to mint.
    function mint(address account, uint256 amount) external onlyOwnerPlugin {
        _mint(account, amount);
    }

    /// @notice Burn tokens.
    /// @dev Only callable by the owner plugin.
    /// @param account The address to burn tokens from.
    /// @param amount The amount of tokens to burn.
    function burn(address account, uint256 amount) external onlyOwnerPlugin {
        _burn(account, amount);
    }

    // The following functions override the base token logic to disable transfers and approvals
    // They will always revert

    function approve(address /* spender */, uint256 /* amount */) public pure override(ERC20, IERC20) returns (bool) {
        revert ApproveDisabled();
    }

    function transfer(address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }
}
