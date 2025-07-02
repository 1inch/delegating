// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IHook } from "@1inch/token-hooks/contracts/interfaces/IHook.sol";
import { IERC20Hooks } from "@1inch/token-hooks/contracts/interfaces/IERC20Hooks.sol";
import { MultiFarmingPlugin } from "@1inch/farming/contracts/MultiFarmingPlugin.sol";
import { ITokenizedDelegationHook, TokenizedDelegationHook, IDelegatedShare, IDelegationHook } from "./TokenizedDelegationHook.sol";
import { IFarmingDelegationHook } from "./interfaces/IFarmingDelegationHook.sol";

contract FarmingDelegationHook is IFarmingDelegationHook, TokenizedDelegationHook {
    error DefaultFarmTokenMismatch();

    uint256 private constant _MAX_FARM_REWARDS = 3;

    mapping(address => address) public defaultFarms;

    constructor(string memory name_, string memory symbol_, IERC20Hooks token_, uint256 maxShareHooks_, uint256 shareHookGasLimit_)
        TokenizedDelegationHook(name_, symbol_, token_, maxShareHooks_, shareHookGasLimit_)
    {}  // solhint-disable-line no-empty-blocks

    function register(string memory name_, string memory symbol_) public override(ITokenizedDelegationHook, TokenizedDelegationHook) returns(IDelegatedShare shareToken) {
        shareToken = super.register(name_, symbol_);
        // TODO: Update when farming package supports hooks
        // MultiFarmingPlugin farm = new MultiFarmingPlugin(shareToken, _MAX_FARM_REWARDS, msg.sender);
        // defaultFarms[msg.sender] = address(farm);
    }

    function delegate(address delegatee) public override(IDelegationHook, TokenizedDelegationHook) {
        super.delegate(delegatee);
        address defaultFarm = defaultFarms[delegatee];
        if (defaultFarm != address(0)) {
            registration[delegatee].addDefaultFarmIfNeeded(msg.sender, defaultFarm);
        }
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        if (farm != address(0) && IHook(farm).TOKEN() != registration[msg.sender]) revert DefaultFarmTokenMismatch();
        defaultFarms[msg.sender] = farm;
        emit DefaultFarmSet(farm);
    }
}
