// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@1inch/erc20-pods/contracts/ERC20Pods.sol";
import "./interfaces/IDelegatedShare.sol";

contract DelegatedShare is IDelegatedShare, ERC20Pods {
    error ApproveDisabled();
    error TransferDisabled();
    error NotOwnerPod();

    address immutable public ownerPod;

    modifier onlyOwnerPod {
        if (msg.sender != ownerPod) revert NotOwnerPod();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxUserPods_,
        uint256 podCallGasLimit_
    ) ERC20(name_, symbol_) ERC20Pods(maxUserPods_, podCallGasLimit_) {
        ownerPod = msg.sender;
    }

    function addDefaultFarmIfNeeded(address account, address farm) external onlyOwnerPod {
        if (!hasPod(account, farm)) {
            _addPod(account, farm);
        }
    }

    function mint(address account, uint256 amount) external onlyOwnerPod {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwnerPod {
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
