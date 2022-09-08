// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./BasicDelegation.sol";

contract VotingDelegation is BasicDelegation {
    constructor(string memory name_, string memory symbol_) BasicDelegation(name_, symbol_) {}
}