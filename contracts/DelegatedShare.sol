// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20, ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Plugins } from "@1inch/token-plugins/contracts/ERC20Plugins.sol";
import { IDelegatedShare } from "./interfaces/IDelegatedShare.sol";

contract DelegatedShare is IDelegatedShare, ERC20Plugins {
    error ApproveDisabled();
    error TransferDisabled();
    error NotOwnerPlugin();

    address immutable public ownerPlugin;

    modifier onlyOwnerPlugin {
        if (msg.sender != ownerPlugin) revert NotOwnerPlugin();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxUserPlugins_,
        uint256 pluginCallGasLimit_
    ) ERC20(name_, symbol_) ERC20Plugins(maxUserPlugins_, pluginCallGasLimit_) {
        ownerPlugin = msg.sender;
    }

    function addDefaultFarmIfNeeded(address account, address farm) external onlyOwnerPlugin {
        if (!hasPlugin(account, farm)) {
            _addPlugin(account, farm);
        }
    }

    function mint(address account, uint256 amount) external onlyOwnerPlugin {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwnerPlugin {
        _burn(account, amount);
    }

    function approve(address /* spender */, uint256 /* amount */) public pure override(ERC20, IERC20) returns (bool) {
        revert ApproveDisabled();
    }

    function transfer(address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }

    function transferFrom(address /* from */, address /* to */, uint256 /* amount */) public pure override(IERC20, ERC20) returns (bool) {
        revert TransferDisabled();
    }

    function increaseAllowance(address /* spender */, uint256 /* addedValue */) public pure override returns (bool) {
        revert ApproveDisabled();
    }

    function decreaseAllowance(address /* spender */, uint256 /* subtractedValue */) public pure override returns (bool) {
        revert ApproveDisabled();
    }
}
