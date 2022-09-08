// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDelegation is IERC20 {
    event Delegate(address account, address delegatee);
    event Undelegate(address account, address delegatee);

    function delegated(address account) external view returns(address);
    function setDelegate(address account, address delegatee) external; // onlyOwner
    function updateBalances(address from, address to, uint256 amount) external; // onlyOwner 
}
