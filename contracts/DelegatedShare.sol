// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@1inch/erc20-pods/contracts/ERC20Pods.sol";
import "./interfaces/IDelegatedShare.sol";

/// @title DelegatedShare
/// @dev DelegatedShare is a specialized version of an ERC20 token with additional functionalities.
contract DelegatedShare is IDelegatedShare, ERC20Pods {
    error ApproveDisabled();
    error TransferDisabled();
    error NotOwnerPod();

    /// @notice The address of the owner pod.
    address immutable public ownerPod;

    /// @dev Throws if called by any account other than the ownerPod.
    modifier onlyOwnerPod {
        if (msg.sender != ownerPod) revert NotOwnerPod();
        _;
    }

    /// @param name_ The name of the token.
    /// @param symbol_ The symbol of the token.
    /// @param maxUserPods_ The maximum number of user pods.
    /// @param podCallGasLimit_ The gas limit for pod calls.
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxUserPods_,
        uint256 podCallGasLimit_
    ) ERC20(name_, symbol_) ERC20Pods(maxUserPods_, podCallGasLimit_) {
        ownerPod = msg.sender;
    }

    /// @notice Add default farm for an account if it doesn't exist.
    /// @dev Only callable by the owner pod.
    /// @param account The account to add default farm for.
    /// @param farm The farm to add.
    function addDefaultFarmIfNeeded(address account, address farm) external onlyOwnerPod {
        if (!hasPod(account, farm)) {
            _addPod(account, farm);
        }
    }

    /// @notice Mint tokens.
    /// @dev Only callable by the owner pod.
    /// @param account The address to mint tokens to.
    /// @param amount The amount of tokens to mint.
    function mint(address account, uint256 amount) external onlyOwnerPod {
        _mint(account, amount);
    }

    /// @notice Burn tokens.
    /// @dev Only callable by the owner pod.
    /// @param account The address to burn tokens from.
    /// @param amount The amount of tokens to burn.
    function burn(address account, uint256 amount) external onlyOwnerPod {
        _burn(account, amount);
    }

    // The following functions override the base token logic to disable transfers and approvals
    // They will always revert

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
