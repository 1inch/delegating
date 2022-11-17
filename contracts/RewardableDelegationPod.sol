// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@1inch/solidity-utils/contracts/libraries/AddressSet.sol";
import "./BasicDelegationPod.sol";
import "./DelegatedShare.sol";
import "./interfaces/IDelegatedShare.sol";

contract RewardableDelegationPod is BasicDelegationPod {
    using AddressSet for AddressSet.Data;

    error NotRegisteredDelegatee();
    error AlreadyRegistered();
    error AnotherDelegateeToken();
    error DefaultFarmTokenMismatch();

    event DefaultFarmSet(address defaultFarm);

    mapping(address => IDelegatedShare) public registration;
    mapping(address => address) public defaultFarms;
    AddressSet.Data private _delegateeTokens;

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

    // we need to update registered shares safely and separately to make best effort of having consistent shares
    function updateBalances(address from, address to, uint256 amount) public override {
        super.updateBalances(from, to, amount);

        if (from != address(0)) {
            address _delegate = delegated[from];
            if (_delegate != address(0)) {
                // solhint-disable-next-line no-empty-blocks
                try registration[_delegate].burn(from, amount) {} catch {}
            }
        }

        if (to != address(0)) {
            address _delegate = delegated[to];
            if (_delegate != address(0)) {
                // solhint-disable-next-line no-empty-blocks
                try registration[_delegate].mint(to, amount) {} catch {}
            }
        }
    }

    function register(string memory name, string memory symbol, uint256 maxUserFarms, address defaultFarm)
        external onlyNotRegistered returns(IDelegatedShare shareToken)
    {
        shareToken = new DelegatedShare(name, symbol, maxUserFarms);
        registration[msg.sender] = IDelegatedShare(shareToken);
        _delegateeTokens.add(address(shareToken));
        if (defaultFarm != address(0)) {
            if (Pod(defaultFarm).token() != address(shareToken)) revert DefaultFarmTokenMismatch();
            defaultFarms[msg.sender] = defaultFarm;
            emit DefaultFarmSet(defaultFarm);
        }
    }

    /// @dev owner of IDelegatedShare should be set to this contract
    function register(IDelegatedShare shareToken, address defaultFarm) external onlyNotRegistered {
        if (!_delegateeTokens.add(address(shareToken))) revert AnotherDelegateeToken();
        registration[msg.sender] = shareToken;
        if (defaultFarm != address(0)) {
            if (Pod(defaultFarm).token() != address(shareToken)) revert DefaultFarmTokenMismatch();
            defaultFarms[msg.sender] = defaultFarm;
            emit DefaultFarmSet(defaultFarm);
        }
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        if (farm != address(0) && Pod(farm).token() != address(registration[msg.sender])) revert DefaultFarmTokenMismatch();
        defaultFarms[msg.sender] = farm;
        emit DefaultFarmSet(farm);
    }

    function _updateAccountingOnDelegate(address prevDelegatee, address delegatee, uint256 balance) internal virtual override {
        super._updateAccountingOnDelegate(prevDelegatee, delegatee, balance);
        if (prevDelegatee != address(0)) {
            registration[prevDelegatee].burn(msg.sender, balance);
        }
        if (delegatee != address(0)) {
            registration[delegatee].mint(msg.sender, balance);
        }
    }
}
