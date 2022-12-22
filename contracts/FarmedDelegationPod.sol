// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./TokenizedDelegationPod.sol";
import "./interfaces/IFarmedDelegationPod.sol";
import "@1inch/farming/contracts/MultiFarmingPod.sol";

import "hardhat/console.sol";

contract FarmedDelegationPod is IFarmedDelegationPod, TokenizedDelegationPod {
    error DefaultFarmTokenMismatch();

    uint256 private constant _MAX_FARM_REWARDS = 3;

    mapping(address => address) public defaultFarms;

    constructor(string memory name_, string memory symbol_, IERC20Pods token_, uint256 maxSharePods_, uint256 sharePodGasLimit_)
        TokenizedDelegationPod(name_, symbol_, token_, maxSharePods_, sharePodGasLimit_)
    {}  // solhint-disable-line no-empty-blocks

    function register(string memory name, string memory symbol) public override(ITokenizedDelegationPod, TokenizedDelegationPod) returns(IDelegatedShare shareToken) {
        shareToken = super.register(name, symbol);
        defaultFarms[msg.sender] = address(new MultiFarmingPod(shareToken, _MAX_FARM_REWARDS));
    }

    function delegate(address delegatee) public override(IDelegationPod, TokenizedDelegationPod) {
        super.delegate(delegatee);
        address defaultFarm = defaultFarms[delegatee];
        if (defaultFarm != address(0)) {
            registration[delegatee].addDefaultFarmIfNeeded(msg.sender, defaultFarm);
        }
        // console.log(balanceOf(delegatee));
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        if (farm != address(0) && Pod(farm).token() != registration[msg.sender]) revert DefaultFarmTokenMismatch();
        defaultFarms[msg.sender] = farm;
        emit DefaultFarmSet(farm);
    }
}
