// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./BasicDelegationPod.sol";
import "./DelegatedShare.sol";
import "./interfaces/IDelegatedShare.sol";

contract RewardableDelegationPod is BasicDelegationPod {
    error NotRegisteredDelegatee();
    error AlreadyRegistered();
    error DefaultFarmTokenMismatch();

    event DefaultFarmSet(address defaultFarm);

    mapping(address => IDelegatedShare) public registration;
    mapping(address => address) public defaultFarms;

    modifier onlyRegistered {
        if (address(registration[msg.sender]) == address(0)) revert NotRegisteredDelegatee();
        _;
    }

    modifier onlyNotRegistered {
        if (address(registration[msg.sender]) != address(0)) revert AlreadyRegistered();
        _;
    }

    // solhint-disable-next-line no-empty-blocks
    constructor(string memory name_, string memory symbol_, address token) BasicDelegationPod(name_, symbol_, token) {}

    function delegate(address delegatee) public override {
        IDelegatedShare delegatedShare = registration[delegatee];
        if (delegatee != address(0) && delegatedShare == IDelegatedShare(address(0))) revert NotRegisteredDelegatee();
        super.delegate(delegatee);
        if (defaultFarms[delegatee] != address(0)) {
            delegatedShare.addDefaultFarmIfNeeded(msg.sender, defaultFarms[delegatee]);
        }
    }

    function register(string memory name, string memory symbol, uint256 maxUserFarms)
        external onlyNotRegistered returns(IDelegatedShare shareToken)
    {
        shareToken = new DelegatedShare(name, symbol, maxUserFarms);
        registration[msg.sender] = IDelegatedShare(shareToken);
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        if (farm != address(0) && Pod(farm).token() != address(registration[msg.sender])) revert DefaultFarmTokenMismatch();
        defaultFarms[msg.sender] = farm;
        emit DefaultFarmSet(farm);
    }

    function _updateBalances(address from, address to, address fromDelegatee, address toDelegatee, uint256 amount) internal virtual override {
        super._updateBalances(from, to, fromDelegatee, toDelegatee, amount);

        if (fromDelegatee != address(0)) {
            registration[fromDelegatee].burn(from, amount);
        }
        if (toDelegatee != address(0)) {
            registration[toDelegatee].mint(to, amount);
        }
    }
}
