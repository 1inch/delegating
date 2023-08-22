// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ITokenizedDelegationPlugin } from "./ITokenizedDelegationPlugin.sol";

interface IFarmingDelegationPlugin is ITokenizedDelegationPlugin {
    event DefaultFarmSet(address defaultFarm);

    function setDefaultFarm(address farm) external;
}
