// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IDelegationPod.sol";
import "./IDelegatedShare.sol";

interface IRewardableDelegationPod is IDelegationPod {
    event DefaultFarmSet(address defaultFarm);
    event RegisterDelegatee(address delegatee);

    function register(string memory name, string memory symbol, uint256 maxUserFarms) external returns(IDelegatedShare shareToken);
    function setDefaultFarm(address farm) external;
}
