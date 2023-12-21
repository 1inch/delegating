// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IPlugin } from "@1inch/token-plugins/contracts/interfaces/IPlugin.sol";
import { IERC20Plugins } from "@1inch/token-plugins/contracts/interfaces/IERC20Plugins.sol";
import { MultiFarmingPlugin } from "@1inch/farming/contracts/MultiFarmingPlugin.sol";
import { ITokenizedDelegationPlugin, TokenizedDelegationPlugin, IDelegatedShare, IDelegationPlugin } from "./TokenizedDelegationPlugin.sol";
import { IFarmingDelegationPlugin } from "./interfaces/IFarmingDelegationPlugin.sol";

contract FarmingDelegationPlugin is IFarmingDelegationPlugin, TokenizedDelegationPlugin {
    error DefaultFarmTokenMismatch();

    uint256 private constant _MAX_FARM_REWARDS = 3;

    mapping(address => address) public defaultFarms;

    constructor(string memory name_, string memory symbol_, IERC20Plugins token_, uint256 maxSharePlugins_, uint256 sharePluginGasLimit_)
        TokenizedDelegationPlugin(name_, symbol_, token_, maxSharePlugins_, sharePluginGasLimit_)
    {}  // solhint-disable-line no-empty-blocks

    function register(string memory name_, string memory symbol_) public override(ITokenizedDelegationPlugin, TokenizedDelegationPlugin) returns(IDelegatedShare shareToken) {
        shareToken = super.register(name_, symbol_);
        MultiFarmingPlugin farm = new MultiFarmingPlugin(shareToken, _MAX_FARM_REWARDS, msg.sender);
        defaultFarms[msg.sender] = address(farm);
    }

    function delegate(address delegatee) public override(IDelegationPlugin, TokenizedDelegationPlugin) {
        super.delegate(delegatee);
        address defaultFarm = defaultFarms[delegatee];
        if (defaultFarm != address(0)) {
            registration[delegatee].addDefaultFarmIfNeeded(msg.sender, defaultFarm);
        }
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        if (farm != address(0) && IPlugin(farm).TOKEN() != registration[msg.sender]) revert DefaultFarmTokenMismatch();
        defaultFarms[msg.sender] = farm;
        emit DefaultFarmSet(farm);
    }
}
