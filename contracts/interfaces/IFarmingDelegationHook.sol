// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ITokenizedDelegationHook } from "./ITokenizedDelegationHook.sol";

interface IFarmingDelegationHook is ITokenizedDelegationHook {
    event DefaultFarmSet(address defaultFarm);

    function setDefaultFarm(address farm) external;
}
