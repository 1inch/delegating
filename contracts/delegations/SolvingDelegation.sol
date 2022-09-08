// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./BasicDelegation.sol";
import "./SolvingDelegateeToken.sol";
import "../interfaces/IDelegateeToken.sol";

contract SolvingDelegation is BasicDelegation {
    error NotRegisteredDelegatee();

    mapping(address => IDelegateeToken) public registration;
    
    constructor(string memory name_, string memory symbol_) BasicDelegation(name_, symbol_) {}

    function setDelegate(address account, address delegatee) public override {
        if (registration[delegatee] == IDelegateeToken(address(0))) revert NotRegisteredDelegatee();
        super.setDelegate(account, delegatee);
    }

    function updateBalances(address from, address to, uint256 amount) public override {
        super.updateBalances(from, to, amount);

        if (to != address(0)) {
            try registration[delegated[to]].mint(to, amount) {} catch {}
        }
        if (from != address(0)) {
            try registration[delegated[from]].burn(from, amount) {} catch {}
        }
    }

    function register(string memory name_, string memory symbol_) external returns(IDelegateeToken) {
        registration[msg.sender] = new SolvingDelegateeToken(name_, symbol_);
        return registration[msg.sender];
    } 

    function register(IDelegateeToken token) external {
        registration[msg.sender] = token;
    } 
}