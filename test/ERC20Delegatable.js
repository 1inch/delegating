const { constants, expect, ether } = require('@1inch/solidity-utils');
const { artifacts } = require('hardhat');

const ERC20DelegatableMock = artifacts.require('ERC20DelegatableMock');
const BasicDelegation = artifacts.require('BasicDelegation');
const WrongDelegation = artifacts.require('WrongDelegation');

const MAX_USER_DELEGATIONS = 7;

describe('ERC20Delegatable', async () => {
    let addr1, addr2, addr3, delegatee, newDelegatee;

    before(async () => {
        [addr1, addr2, addr3, delegatee, newDelegatee] = await web3.eth.getAccounts();
    });

    beforeEach(async () => {
        this.erc20delegatable = await ERC20DelegatableMock.new('st1INCH', 'st1INCH', MAX_USER_DELEGATIONS);
        this.delegation = await BasicDelegation.new('DelegationContract', 'DC');
        await this.delegation.transferOwnership(this.erc20delegatable.address);
        this.wrongDelegation = await WrongDelegation.new('WrongDelegationContract', 'WDC');
        await this.wrongDelegation.transferOwnership(this.erc20delegatable.address);
    });

    const createDelegations = async (amount) => {
        this.delegations = [];
        for (let i = 0; i < amount; i++) {
            this.delegations[i] = await BasicDelegation.new(`DelegationContract${i}`, `DC${i}`);
            await this.delegations[i].transferOwnership(this.erc20delegatable.address);
        }
    };

    const delegate = async (delegations, delegatee, delegator) => {
        for (const delegation of delegations) {
            await this.erc20delegatable.delegate(delegation.address, delegatee, { from: delegator });
        }
    };

    describe('userIsDelegating', async () => {
        it('should return true if account delegate', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            expect(await this.erc20delegatable.userIsDelegating(addr1, this.delegation.address)).to.be.equals(true);
        });

        it('should return false if account doesn\'t delegate', async () => {
            expect(await this.erc20delegatable.userIsDelegating(addr1, this.delegation.address)).to.be.equals(false);
        });

        it('should return false if account undelegate', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            await this.erc20delegatable.undelegate(this.delegation.address);
            expect(await this.erc20delegatable.userIsDelegating(addr1, this.delegation.address)).to.be.equals(false);
        });
    });

    describe('userDelegationsCount', async () => {
        beforeEach(async () => {
            await createDelegations(MAX_USER_DELEGATIONS);
        });

        it('should increase after delegate', async () => {
            let delegationsCount = await this.erc20delegatable.userDelegationsCount(addr1);
            for (const delegation of this.delegations) {
                await this.erc20delegatable.delegate(delegation.address, delegatee);
                delegationsCount = delegationsCount.addn(1);
                expect(await this.erc20delegatable.userDelegationsCount(addr1)).to.be.bignumber.eq(delegationsCount);
            }
        });

        it('should decrease after undelegate', async () => {
            await delegate(this.delegations, delegatee, addr1);
            let delegationsCount = await this.erc20delegatable.userDelegationsCount(addr1);
            for (const delegation of this.delegations) {
                await this.erc20delegatable.undelegate(delegation.address);
                delegationsCount = delegationsCount.subn(1);
                expect(await this.erc20delegatable.userDelegationsCount(addr1)).to.be.bignumber.eq(delegationsCount);
            }
        });

        it('should not change after redelegate', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            const delegationsCount = await this.erc20delegatable.userDelegationsCount(addr1);
            await this.erc20delegatable.delegate(this.delegation.address, newDelegatee);
            expect(await this.erc20delegatable.userDelegationsCount(addr1)).to.be.bignumber.eq(delegationsCount);
        });
    });

    describe('userDelegationsAt', async () => {
        it('should return delegations', async () => {
            await createDelegations(MAX_USER_DELEGATIONS);
            await delegate(this.delegations, delegatee, addr1);
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await this.erc20delegatable.userDelegationsAt(addr1, i)).to.be.eq(this.delegations[i].address);
            }
            expect(await this.erc20delegatable.userDelegationsAt(addr1, MAX_USER_DELEGATIONS + 1)).to.be.eq(constants.ZERO_ADDRESS);
        });
    });

    describe('userDelegations', async () => {
        it('should return delegations', async () => {
            await createDelegations(MAX_USER_DELEGATIONS);
            await delegate(this.delegations, delegatee, addr1);
            expect(await this.erc20delegatable.userDelegations(addr1)).to.be.deep.eq(this.delegations.map(d => d.address));
        });
    });

    describe('delegate', async () => {
        it('should delegate', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            expect(await this.erc20delegatable.userIsDelegating(addr1, this.delegation.address)).to.be.equals(true);
            expect(await this.delegation.delegated(addr1)).to.be.equals(delegatee);
        });

        it('should not delegate more than MAX_USER_DELEGATIONS', async () => {
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                const delegation = await BasicDelegation.new(`DelegationContract${i}`, `DC${i}`);
                await delegation.transferOwnership(this.erc20delegatable.address);
                await this.erc20delegatable.delegate(delegation.address, delegatee);
            }
            await expect(this.erc20delegatable.delegate(this.delegation.address, delegatee))
                .to.eventually.be.rejectedWith('MaxUserDelegationsReached()');
        });

        it('should redelegate', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            await this.erc20delegatable.delegate(this.delegation.address, newDelegatee);
            expect(await this.delegation.delegated(addr1)).to.be.equals(newDelegatee);
        });

        it('should redelegate when MAX_USER_DELEGATIONS reached', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            for (let i = 1; i < MAX_USER_DELEGATIONS; i++) {
                const delegation = await BasicDelegation.new(`DelegationContract${i}`, `DC${i}`);
                await delegation.transferOwnership(this.erc20delegatable.address);
                await this.erc20delegatable.delegate(delegation.address, delegatee);
            }
            await this.erc20delegatable.delegate(this.delegation.address, newDelegatee);
            expect(await this.delegation.delegated(addr1)).to.be.equals(newDelegatee);
        });

        it('should not delegate to delegation zero-address', async () => {
            await expect(this.erc20delegatable.delegate(constants.ZERO_ADDRESS, delegatee))
                .to.eventually.be.rejectedWith('ZeroDelegationAddress()');
        });

        it('should not delegate to the same delegatee', async () => {
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            await expect(this.erc20delegatable.delegate(this.delegation.address, delegatee))
                .to.eventually.be.rejectedWith('SameDelegateeAssigned()');
        });

        it('should increase delegatee\'s balance in delegation contract', async () => {
            const amount = ether('1');
            await this.erc20delegatable.mint(addr1, amount);

            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq('0');
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(amount);
        });

        it('should decrease delegatee\'s balance in delegation contract after redelegation to another delegatee', async () => {
            const amount = ether('1');
            await this.erc20delegatable.mint(addr1, amount);
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);

            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(amount);
            expect(await this.delegation.balanceOf(newDelegatee)).to.be.bignumber.eq('0');

            await this.erc20delegatable.delegate(this.delegation.address, newDelegatee);

            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq('0');
            expect(await this.delegation.balanceOf(newDelegatee)).to.be.bignumber.eq(amount);
        });

        it('should increase delegatee\'s balance in delegation contract after increasing delegator balance', async () => {
            const amount = ether('1');
            const additionalAmount = ether('0.5');
            await this.erc20delegatable.mint(addr1, amount);
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);

            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(amount);
            await this.erc20delegatable.mint(addr1, additionalAmount);
            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(amount.add(additionalAmount));
        });

        it('should decrease delegatee\'s balance in delegation contract after decreasing delegator balance', async () => {
            const amount = ether('1');
            const additionalAmount = ether('0.5');
            await this.erc20delegatable.mint(addr1, amount);
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);

            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(amount);
            await this.erc20delegatable.transfer(addr2, additionalAmount);
            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(amount.sub(additionalAmount));
        });
    });

    describe('undelegate', async () => {
        beforeEach(async () => {
            const amount = ether('1');
            await this.erc20delegatable.mint(addr1, amount);
            await this.erc20delegatable.delegate(this.delegation.address, delegatee);
        });

        it('should undelegate', async () => {
            await this.erc20delegatable.undelegate(this.delegation.address);
            expect(await this.erc20delegatable.userIsDelegating(addr1, this.delegation.address)).to.be.equals(false);
            expect(await this.delegation.delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
        });

        it('should decrease delegatee\'s balance in delegation contract', async () => {
            const balanceBefore = await this.delegation.balanceOf(delegatee);
            const delegatorBalance = await this.erc20delegatable.balanceOf(addr1);
            await this.erc20delegatable.undelegate(this.delegation.address);
            expect(await this.delegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBefore.sub(delegatorBalance));
        });

        it('should reset delegatee in delegation contract', async () => {
            await this.erc20delegatable.undelegate(this.delegation.address);
            expect(await this.delegation.delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
        });

        it('should not udelegatee not existed delegation contract', async () => {
            await this.erc20delegatable.undelegate(this.delegation.address);
            await expect(this.erc20delegatable.undelegate(this.delegation.address))
                .to.eventually.be.rejectedWith('DelegationNotExist()');
        });

        describe('should not revert when delegation contract methods', async () => {
            beforeEach(async () => {
                await this.erc20delegatable.delegate(this.wrongDelegation.address, delegatee);
            });

            it('reverting at setDelegate', async () => {
                await this.wrongDelegation.setMethodReverting('setDelegate', true);
                await this.erc20delegatable.undelegate(this.wrongDelegation.address);
                expect(await this.erc20delegatable.userIsDelegating(addr1, this.wrongDelegation.address)).to.be.equals(false);
            });

            it('has OutOfGas at setDelegate', async () => {
                await this.wrongDelegation.setMethodOutOfGas('setDelegate', true);
                await this.erc20delegatable.undelegate(this.wrongDelegation.address);
                expect(await this.erc20delegatable.userIsDelegating(addr1, this.wrongDelegation.address)).to.be.equals(false);
            });

            it('reverting at updateBalances', async () => {
                await this.wrongDelegation.setMethodReverting('updateBalances', true);
                await this.erc20delegatable.undelegate(this.wrongDelegation.address);
                expect(await this.erc20delegatable.userIsDelegating(addr1, this.wrongDelegation.address)).to.be.equals(false);
            });

            it('has OutOfGas at updateBalances', async () => {
                await this.wrongDelegation.setMethodOutOfGas('updateBalances', true);
                await this.erc20delegatable.undelegate(this.wrongDelegation.address);
                expect(await this.erc20delegatable.userIsDelegating(addr1, this.wrongDelegation.address)).to.be.equals(false);
            });
        });
    });

    describe('undelegateAll', async () => {
        beforeEach(async () => {
            const amount = ether('1');
            await this.erc20delegatable.mint(addr1, amount);
            await createDelegations(MAX_USER_DELEGATIONS);
            await delegate(this.delegations, delegatee, addr1);
        });

        it('should undelegate all delegations', async () => {
            await this.erc20delegatable.undelegateAll();
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await this.erc20delegatable.userIsDelegating(addr1, this.delegations[i].address)).to.be.equals(false);
                expect(await this.delegations[i].delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
            }
        });

        it('should decrease delegatee\'s balance in all delegation contracts', async () => {
            const delegationBalancesBefore = [];
            const delegatorBalance = await this.erc20delegatable.balanceOf(addr1);
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                delegationBalancesBefore[i] = await this.delegations[i].balanceOf(delegatee);
            }
            await this.erc20delegatable.undelegateAll();
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(delegationBalancesBefore[i].sub(delegatorBalance));
                delegationBalancesBefore[i] = await this.delegations[i].balanceOf(delegatee);
            }
        });

        it('should reset delegatee in all delegation contracts', async () => {
            await this.erc20delegatable.undelegateAll();
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await this.delegations[i].delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
            }
        });
    });

    describe('_beforeTokenTransfer', async () => {
        beforeEach(async () => {
            this.addr1Amount = ether('1');
            this.addr2Amount = ether('2.5');
            await this.erc20delegatable.mint(addr1, this.addr1Amount);
            await this.erc20delegatable.mint(addr2, this.addr2Amount);
            await createDelegations(MAX_USER_DELEGATIONS);
            await delegate(this.delegations, delegatee, addr1);
            await delegate(this.delegations, newDelegatee, addr2);

            this.delegateeBalancesBefore = [];
            this.newDelegateeBalancesBefore = [];
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                this.delegateeBalancesBefore[i] = await this.delegations[i].balanceOf(delegatee);
                this.newDelegateeBalancesBefore[i] = await this.delegations[i].balanceOf(newDelegatee);
            }
        });

        it('should nothing changed when account send tokens to himself', async () => {
            await this.erc20delegatable.transfer(addr1, this.addr1Amount.divn(2));
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(this.delegateeBalancesBefore[i]);
                expect(await this.delegations[i].balanceOf(newDelegatee)).to.be.bignumber.eq(this.newDelegateeBalancesBefore[i]);
            }
        });

        it('should nothing changed when account send 0 tokens', async () => {
            await this.erc20delegatable.transfer(addr2, '0');
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(this.delegateeBalancesBefore[i]);
                expect(await this.delegations[i].balanceOf(newDelegatee)).to.be.bignumber.eq(this.newDelegateeBalancesBefore[i]);
            }
        });

        describe('should change delegatees balances in delegation contracts correct after changing accounts balances', async () => {
            it('when both parties are participating the same delegation', async () => {
                const amount = this.addr1Amount.divn(2);
                await this.erc20delegatable.transfer(addr2, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(this.delegateeBalancesBefore[i].sub(amount));
                    expect(await this.delegations[i].balanceOf(newDelegatee)).to.be.bignumber.eq(this.newDelegateeBalancesBefore[i].add(amount));
                }
            });

            it('when sender is participating a delegation, but receiver is not', async () => {
                await this.erc20delegatable.undelegateAll({ from: addr2 });
                for (let i = 0; i < this.delegations.length; i++) {
                    this.newDelegateeBalancesBefore[i] = await this.delegations[i].balanceOf(newDelegatee);
                }

                const amount = this.addr1Amount.divn(2);
                await this.erc20delegatable.transfer(addr2, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(this.delegateeBalancesBefore[i].sub(amount));
                    expect(await this.delegations[i].balanceOf(newDelegatee)).to.be.bignumber.eq(this.newDelegateeBalancesBefore[i]);
                }
            });

            it('when receiver is participating a delegation, but sender is not', async () => {
                await this.erc20delegatable.undelegateAll({ from: addr1 });
                for (let i = 0; i < this.delegations.length; i++) {
                    this.delegateeBalancesBefore[i] = await this.delegations[i].balanceOf(delegatee);
                }

                const amount = this.addr1Amount.divn(2);
                await this.erc20delegatable.transfer(addr2, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(this.delegateeBalancesBefore[i]);
                    expect(await this.delegations[i].balanceOf(newDelegatee)).to.be.bignumber.eq(this.newDelegateeBalancesBefore[i].add(amount));
                }
            });

            it('when both parties aren\'t participating the delegation', async () => {
                const amount = ether('1');
                await this.erc20delegatable.mint(addr3, amount);
                await this.erc20delegatable.transfer(this.erc20delegatable.address, amount, { from: addr3 });
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await this.delegations[i].balanceOf(delegatee)).to.be.bignumber.eq(this.delegateeBalancesBefore[i]);
                    expect(await this.delegations[i].balanceOf(newDelegatee)).to.be.bignumber.eq(this.newDelegateeBalancesBefore[i]);
                }
            });
        });

        describe('should not revert when delegation contract methods reverting', async () => {
            beforeEach(async () => {
                await this.erc20delegatable.undelegate(this.delegations[0].address, { from: addr1 });
                await this.erc20delegatable.undelegate(this.delegations[0].address, { from: addr2 });
                await this.erc20delegatable.delegate(this.wrongDelegation.address, delegatee);
                await this.erc20delegatable.delegate(this.wrongDelegation.address, newDelegatee, { from: addr2 });
                await this.wrongDelegation.setMethodReverting('updateBalances', true);
            });

            it('when both parties are participating the same delegation', async () => {
                await this.erc20delegatable.transfer(addr2, this.addr1Amount);
            });

            it('when sender is participating a delegation, but receiver is not', async () => {
                await this.erc20delegatable.undelegateAll({ from: addr2 });
                await this.erc20delegatable.transfer(addr2, this.addr1Amount);
            });

            it('when receiver is participating a delegation, but sender is not', async () => {
                await this.erc20delegatable.undelegateAll({ from: addr1 });
                await this.erc20delegatable.transfer(addr2, this.addr1Amount);
            });
        });

        describe('should not revert when delegation contract methods has OutOfGas', async () => {
            beforeEach(async () => {
                await this.erc20delegatable.undelegate(this.delegations[0].address, { from: addr1 });
                await this.erc20delegatable.undelegate(this.delegations[0].address, { from: addr2 });
                await this.erc20delegatable.delegate(this.wrongDelegation.address, delegatee);
                await this.erc20delegatable.delegate(this.wrongDelegation.address, newDelegatee, { from: addr2 });
                await this.wrongDelegation.setMethodOutOfGas('updateBalances', true);
            });

            it('when both parties are participating the same delegation', async () => {
                await this.erc20delegatable.transfer(addr2, this.addr1Amount);
            });

            it('when sender is participating a delegation, but receiver is not', async () => {
                await this.erc20delegatable.undelegateAll({ from: addr2 });
                await this.erc20delegatable.transfer(addr2, this.addr1Amount);
            });

            it('when receiver is participating a delegation, but sender is not', async () => {
                await this.erc20delegatable.undelegateAll({ from: addr1 });
                await this.erc20delegatable.transfer(addr2, this.addr1Amount);
            });
        });
    });
});
