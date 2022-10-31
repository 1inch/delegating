// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@1inch/erc20-pods/contracts/interfaces/IPod.sol";

interface IDelegationPod is IPod, IERC20 {
    event Delegate(address account, address delegatee);

    function delegated(address account) external view returns(address);
    function delegate(address delegatee) external;
}
