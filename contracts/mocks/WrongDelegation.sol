// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "erc20-pods/contracts/Pod.sol";

import "../interfaces/IDelegationPod.sol";

contract WrongDelegation is IDelegationPod, Pod, ERC20 {
    error DelegationContractRevert();

    mapping(string => bool) public isRevert;
    mapping(string => bool) public isOutOfGas;

    constructor(string memory name_, string memory symbol_, address token)
        ERC20(name_, symbol_) Pod(token)
    {}  // solhint-disable-line no-empty-blocks

    function delegated(address /* account */) external view returns(address) {
        if (isRevert["delegated"]) revert DelegationContractRevert();
        if (isOutOfGas["delegated"]) assert(false);
        return address(0);
    }

    function delegate(address /* delegatee */) public virtual {
        if (isRevert["delegate"]) revert DelegationContractRevert();
        if (isOutOfGas["delegate"]) assert(false);
    }

    function updateBalances(address /* from */, address /* to */, uint256 /* amount */) public virtual onlyToken {
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
