// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@1inch/farming/contracts/ERC20Farmable.sol";
import "../interfaces/IDelegateeToken.sol";

contract DelegateeToken is IDelegateeToken, ERC20Farmable, Ownable {
    error ApproveDisabled();
    error TransferDisabled();
    error TransferFromDisabled();

    constructor(
        string memory name,
        string memory symbol,
        uint256 maxUserFarms
    ) ERC20(name, symbol) ERC20Farmable(maxUserFarms) {}

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }

    function approve(address /* spender */, uint256 /* amount */) public pure override(ERC20, IERC20) returns (bool) {
        revert ApproveDisabled();
    }

    function transfer(address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferFromDisabled();
    }
}
