// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IPod } from "@1inch/erc20-pods/contracts/interfaces/IPod.sol";
import { IERC20Pods } from "@1inch/erc20-pods/contracts/interfaces/IERC20Pods.sol";
import { MultiFarmingPod } from "@1inch/farming/contracts/MultiFarmingPod.sol";
import { ITokenizedDelegationPod, TokenizedDelegationPod, IDelegatedShare, IDelegationPod } from "./TokenizedDelegationPod.sol";
import { IFarmingDelegationPod } from "./interfaces/IFarmingDelegationPod.sol";

contract FarmingDelegationPod is IFarmingDelegationPod, TokenizedDelegationPod {
    error DefaultFarmTokenMismatch();

    uint256 private constant _MAX_FARM_REWARDS = 3;

    mapping(address => address) public defaultFarms;

    constructor(string memory name_, string memory symbol_, IERC20Pods token_, uint256 maxSharePods_, uint256 sharePodGasLimit_)
        TokenizedDelegationPod(name_, symbol_, token_, maxSharePods_, sharePodGasLimit_)
    {}  // solhint-disable-line no-empty-blocks

    function register(string memory name_, string memory symbol_) public override(ITokenizedDelegationPod, TokenizedDelegationPod) returns(IDelegatedShare shareToken) {
        shareToken = super.register(name_, symbol_);
        MultiFarmingPod farm = new MultiFarmingPod(shareToken, _MAX_FARM_REWARDS);
        farm.transferOwnership(msg.sender);
        defaultFarms[msg.sender] = address(farm);
    }

    function delegate(address delegatee) public override(IDelegationPod, TokenizedDelegationPod) {
        super.delegate(delegatee);
        address defaultFarm = defaultFarms[delegatee];
        if (defaultFarm != address(0)) {
            registration[delegatee].addDefaultFarmIfNeeded(msg.sender, defaultFarm);
        }
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        if (farm != address(0) && IPod(farm).token() != registration[msg.sender]) revert DefaultFarmTokenMismatch();
        defaultFarms[msg.sender] = farm;
        emit DefaultFarmSet(farm);
    }
}
