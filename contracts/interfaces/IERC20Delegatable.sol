// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IDelegationTopic.sol";

interface IERC20Delegatable is IERC20 {
    function userIsDelegating(address account, address delegation) external view returns(bool);
    function userDelegationsCount(address account) external view returns(uint256);
    function userDelegationsAt(address account, uint256 index) external view returns(address);
    function userDelegations(address account) external view returns(address[] memory);

    function delegate(IDelegationTopic delegation, address delegat) external; // limit
    function undelegate(IDelegationTopic delegation) external;
    function undelegateAll() external;
}
