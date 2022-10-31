// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@1inch/erc20-pods/contracts/Pod.sol";

import "../interfaces/IDelegationPod.sol";

contract WrongDelegationMock is IDelegationPod, Pod, ERC20 {
    error DelegationContractRevert();

    mapping(bytes4 => bool) public isRevert;
    mapping(bytes4 => bool) public isOutOfGas;

    constructor(string memory name_, string memory symbol_, address token)
        ERC20(name_, symbol_) Pod(token)
    {}  // solhint-disable-line no-empty-blocks

    function delegated(address /* account */) external view returns(address) {
        if (isRevert[msg.sig]) revert DelegationContractRevert();
        if (isOutOfGas[msg.sig]) assert(false);
        return address(0);
    }

    function delegate(address /* delegatee */) external virtual {
        if (isRevert[msg.sig]) revert DelegationContractRevert();
        if (isOutOfGas[msg.sig]) assert(false);
    }

    function updateBalances(address /* from */, address /* to */, uint256 /* amount */) external virtual onlyToken {
        if (isRevert[msg.sig]) revert DelegationContractRevert();
        if (isOutOfGas[msg.sig]) assert(false);
    }

    function setMethodReverting(bytes4 method, bool isRevert_) external {
        isRevert[method] = isRevert_;
    }

    function setMethodOutOfGas(bytes4 method, bool isOutOfGas_) external {
        isOutOfGas[method] = isOutOfGas_;
    }
}
