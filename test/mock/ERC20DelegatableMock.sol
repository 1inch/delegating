// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../contracts/ERC20Delegatable.sol";

contract ERC20DelegatableMock is ERC20Delegatable, Ownable {
    constructor(string memory name, string memory symbol, uint256 maxUserFarms)
        ERC20Delegatable(maxUserFarms) ERC20(name, symbol) {}

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }
}
