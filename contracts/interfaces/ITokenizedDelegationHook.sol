// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IDelegationHook } from "./IDelegationHook.sol";
import { IDelegatedShare } from "./IDelegatedShare.sol";

interface ITokenizedDelegationHook is IDelegationHook {
    event RegisterDelegatee(address delegatee);

    function register(string memory name, string memory symbol) external returns(IDelegatedShare shareToken);
    function registration(address account) external returns(IDelegatedShare shareToken);
}
