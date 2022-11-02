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

    function updateBalances(address from, address to, uint256 amount) public override {
        super.updateBalances(from, to, amount);

        if (to != address(0)) {
            // Following call may be unsafe as we are already in safe call
            registration[delegated[to]].mint(to, amount);
        }
        if (from != address(0)) {
            // Following call may be unsafe as we are already in safe call
            registration[delegated[from]].burn(from, amount);
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
}
