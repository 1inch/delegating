// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDelegatedShare is IERC20 {
    function addDefaultFarmIfNeeded(address account, address farm) external; // onlyOwner
    function mint(address account, uint256 amount) external; // onlyOwner
    function burn(address account, uint256 amount) external; // onlyOwner
}
