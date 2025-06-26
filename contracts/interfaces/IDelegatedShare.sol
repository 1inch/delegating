// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20Hooks } from "@1inch/token-hooks/contracts/interfaces/IERC20Hooks.sol";

interface IDelegatedShare is IERC20Hooks {
    function addDefaultFarmIfNeeded(address account, address farm) external; // onlyOwner
    function mint(address account, uint256 amount) external; // onlyOwner
    function burn(address account, uint256 amount) external; // onlyOwner
}
