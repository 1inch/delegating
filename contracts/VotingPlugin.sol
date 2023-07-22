// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { Checkpoints } from "@openzeppelin/contracts/utils/Checkpoints.sol";
import { IERC20Plugins, DelegationPlugin } from "./DelegationPlugin.sol";

contract VotingPlugin is DelegationPlugin {
    using Checkpoints for Checkpoints.Trace224;

    error ERC5805FutureLookup(uint256 timepoint, uint48 clock);

    Checkpoints.Trace224 private _totalCheckpoints;
    mapping(address => Checkpoints.Trace224) private _delegateCheckpoints;

    constructor(string memory name, string memory symbol, IERC20Plugins token)
        DelegationPlugin(name, symbol, token)
    {}  // solhint-disable-line no-empty-blocks

    /**
     * @dev Get number of checkpoints for `account`.
     */
    function numCheckpoints(address account) public view virtual returns (uint32) {
        return SafeCast.toUint32(_delegateCheckpoints[account].length());
    }

    /**
     * @dev Get the `pos`-th checkpoint for `account`.
     */
    function checkpoints(address account, uint32 pos) public view virtual returns (Checkpoints.Checkpoint224 memory) {
        return _delegateCheckpoints[account]._checkpoints[pos];
    }

    /**
     * @dev Clock used for flagging checkpoints. Can be overridden to implement timestamp based
     * checkpoints (and voting), in which case {CLOCK_MODE} should be overridden as well to match.
     */
    function clock() public view virtual returns (uint48) {
        return SafeCast.toUint48(block.number);
    }

    /**
     * @dev Returns the current amount of votes that `account` has.
     */
    function getVotes(address account) public view virtual returns (uint256) {
        return _delegateCheckpoints[account].latest();
    }

    /**
     * @dev Returns the amount of votes that `account` had at a specific moment in the past. If the `clock()` is
     * configured to use block numbers, this will return the value at the end of the corresponding block.
     *
     * Requirements:
     *
     * - `timepoint` must be in the past. If operating using block numbers, the block must be already mined.
     */
    function getPastVotes(address account, uint256 timepoint) public view virtual returns (uint256) {
        uint48 currentTimepoint = clock();
        if (timepoint >= currentTimepoint) {
            revert ERC5805FutureLookup(timepoint, currentTimepoint);
        }
        return _delegateCheckpoints[account].upperLookupRecent(SafeCast.toUint32(timepoint));
    }

    /**
     * @dev Returns the total supply of votes available at a specific moment in the past. If the `clock()` is
     * configured to use block numbers, this will return the value at the end of the corresponding block.
     *
     * NOTE: This value is the sum of all available votes, which is not necessarily the sum of all delegated votes.
     * Votes that have not been delegated are still part of total supply, even though they would not participate in a
     * vote.
     *
     * Requirements:
     *
     * - `timepoint` must be in the past. If operating using block numbers, the block must be already mined.
     */
    function getPastTotalSupply(uint256 timepoint) public view virtual returns (uint256) {
        uint48 currentTimepoint = clock();
        if (timepoint >= currentTimepoint) {
            revert ERC5805FutureLookup(timepoint, currentTimepoint);
        }
        return _totalCheckpoints.upperLookupRecent(SafeCast.toUint32(timepoint));
    }

    function _updateBalances(address from, address to, address fromDelegatee, address toDelegatee, uint256 amount) internal virtual override {
        super._updateBalances(from, to, fromDelegatee, toDelegatee, amount);

        if (fromDelegatee != toDelegatee && amount > 0) {
            if (fromDelegatee == address(0)) {
                _delegateCheckpoints[toDelegatee].push(SafeCast.toUint32(clock()), SafeCast.toUint224(balanceOf(toDelegatee)));
                _totalCheckpoints.push(SafeCast.toUint32(clock()), SafeCast.toUint224(totalSupply()));
            } else if (toDelegatee == address(0)) {
                _delegateCheckpoints[fromDelegatee].push(SafeCast.toUint32(clock()), SafeCast.toUint224(balanceOf(fromDelegatee)));
                _totalCheckpoints.push(SafeCast.toUint32(clock()), SafeCast.toUint224(totalSupply()));
            } else {
                _delegateCheckpoints[fromDelegatee].push(SafeCast.toUint32(clock()), SafeCast.toUint224(balanceOf(fromDelegatee)));
                _delegateCheckpoints[toDelegatee].push(SafeCast.toUint32(clock()), SafeCast.toUint224(balanceOf(toDelegatee)));
            }
        }
    }
}
