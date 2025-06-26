// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IHook } from "@1inch/token-hooks/contracts/interfaces/IHook.sol";

interface IDelegationPlugin is IHook, IERC20 {
    event Delegated(address account, address delegatee);

    function delegated(address delegator) external view returns(address delegatee);
    function delegate(address delegatee) external;
}
