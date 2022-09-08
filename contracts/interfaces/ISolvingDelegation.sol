// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IDelegation.sol";
import "./IDelegateeToken.sol";

interface ISolvingDelegation is IDelegation {
    function register(string memory name_, string memory symbol_) external returns(IDelegateeToken);
    function register(IDelegateeToken token) external;
}
