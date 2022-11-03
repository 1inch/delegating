// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@1inch/erc20-pods/contracts/ERC20Pods.sol";
import "./interfaces/IDelegatedShare.sol";

contract DelegatedShare is IDelegatedShare, ERC20Pods, Ownable {
    error ApproveDisabled();
    error TransferDisabled();
    error TransferFromDisabled();

    constructor(
        string memory name,
        string memory symbol,
        uint256 maxUserFarms
    ) ERC20(name, symbol) ERC20Pods(maxUserFarms) {} // solhint-disable-line no-empty-blocks

    function addDefaultFarmIfNeeded(address account, address farm) external onlyOwner {
        if (!hasPod(account, farm)) {
            _addPod(account, farm);
        }
    }

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
