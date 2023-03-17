// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPod } from "@1inch/erc20-pods/contracts/interfaces/IPod.sol";

interface IDelegationPod is IPod, IERC20 {
    event Delegated(address account, address delegatee);

    function delegated(address delegator) external view returns(address delegatee);
    function delegate(address delegatee) external;
}
