// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../contracts/interfaces/IDelegationTopic.sol";

contract WrongDelegation is IDelegationTopic, ERC20, Ownable {
    error DelegationContractRevert();

    mapping(string => bool) public isRevert;
    mapping(string => bool) public isOutOfGas;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function delegated(address /* account */) external view returns(address) {
        if (isRevert["delegated"]) revert DelegationContractRevert();
        if (isOutOfGas["delegated"]) assert(false);
        return address(0);
    }

    function setDelegate(address /* account */, address /* delegatee */) public virtual onlyOwner {
        if (isRevert["setDelegate"]) revert DelegationContractRevert();
        if (isOutOfGas["setDelegate"]) assert(false);
    }

    function updateBalances(address /* from */, address /* to */, uint256 /* amount */) public virtual onlyOwner {
        if (isRevert["updateBalances"]) revert DelegationContractRevert();
        if (isOutOfGas["updateBalances"]) assert(false);
    }

    function setMethodReverting(string memory method, bool isRevert_) external {
        isRevert[method] = isRevert_;
    }

    function setMethodOutOfGas(string memory method, bool isOutOfGas_) external {
        isOutOfGas[method] = isOutOfGas_;
    }
}
