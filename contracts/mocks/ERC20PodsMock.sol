// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@1inch/erc20-pods/contracts/ERC20Pods.sol";

contract ERC20PodsMock is ERC20Pods {
    constructor(string memory name, string memory symbol, uint256 podsLimit)
        ERC20(name, symbol)
        ERC20Pods(podsLimit)
    {} // solhint-disable-line no-empty-blocks

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
