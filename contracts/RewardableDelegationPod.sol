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
        external onlyNotRegistered returns(IDelegatedShare token)
    {
        token = new DelegatedShare(name, symbol, maxUserFarms);
        registration[msg.sender] = token;
        _delegateeTokens.add(address(token));
        if (defaultFarm != address(0)) {
            defaultFarms[msg.sender] = defaultFarm;
        }
    }

    /// @dev owner of IDelegatedShare should be set to this contract
    function register(IDelegatedShare token, address defaultFarm) external onlyNotRegistered {
        if (!_delegateeTokens.add(address(token))) revert AnotherDelegateeToken();
        registration[msg.sender] = token;
        if (defaultFarm != address(0)) {
            defaultFarms[msg.sender] = defaultFarm;
        }
    }

    function setDefaultFarm(address farm) external onlyRegistered {
        defaultFarms[msg.sender] = farm;
    }

    function _updateAccountingOnDelegate(address prevDelegatee, address delegatee, uint256 balance) internal virtual override {
        if (prevDelegatee != address(0)) {
            registration[prevDelegatee].burn(msg.sender, balance);
        }
        if (delegatee != address(0)) {
            registration[delegatee].mint(msg.sender, balance);
        }
    }
}
