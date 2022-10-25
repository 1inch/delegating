const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { BigNumber: BN } = require('ethers');

const MAX_USER_DELEGATIONS = 7;

describe('ERC20Delegatable', async () => {
    let addr1, addr2, addr3, delegatee, newDelegatee;
    let BasicDelegationTopic;
    let ERC20DelegatableMock;
    let WrongDelegation;

    before(async () => {
        [addr1, addr2, addr3, delegatee, newDelegatee] = await ethers.getSigners();
        BasicDelegationTopic = await ethers.getContractFactory('BasicDelegationTopic');
        ERC20DelegatableMock = await ethers.getContractFactory('ERC20DelegatableMock');
        WrongDelegation = await ethers.getContractFactory('WrongDelegation');
    });

    async function initContracts () {
        const erc20delegatable = await ERC20DelegatableMock.deploy('st1INCH', 'st1INCH', MAX_USER_DELEGATIONS);
        await erc20delegatable.deployed();
        const delegationTopic = await BasicDelegationTopic.deploy('DelegationContract', 'DC');
        await delegationTopic.deployed();
        await delegationTopic.transferOwnership(erc20delegatable.address);
        const wrongDelegation = await WrongDelegation.deploy('WrongDelegationContract', 'WDC');
        await wrongDelegation.deployed();
        await wrongDelegation.transferOwnership(erc20delegatable.address);
        return { erc20delegatable, delegationTopic, wrongDelegation };
    };

    const createDelegations = async (amount, erc20delegatable) => {
        const delegations = [];
        for (let i = 0; i < amount; i++) {
            delegations.push(await BasicDelegationTopic.deploy(`DelegationContract${i}`, `DC${i}`));
            await delegations[i].deployed();
            await delegations[i].transferOwnership(erc20delegatable.address);
        }
        return delegations;
    };

    const delegate = async (delegations, delegatee, delegator, erc20delegatable) => {
        for (const delegation of delegations) {
            await erc20delegatable.connect(delegator).delegate(delegation.address, delegatee.address);
        }
    };

    describe('userIsDelegating', async () => {
        it('should return true if account delegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            expect(await erc20delegatable.userIsDelegating(addr1.address, delegationTopic.address)).to.equal(true);
        });

        it('should return false if account doesn\'t delegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            expect(await erc20delegatable.userIsDelegating(addr1.address, delegationTopic.address)).to.equal(false);
        });

        it('should return false if account undelegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            await erc20delegatable.undelegate(delegationTopic.address);
            expect(await erc20delegatable.userIsDelegating(addr1.address, delegationTopic.address)).to.equal(false);
        });
    });

    describe('userDelegationsCount', async () => {
        async function initContractsAndDelegation () {
            const { erc20delegatable, delegationTopic, wrongDelegation } = await initContracts();
            const delegations = await createDelegations(erc20delegatable, MAX_USER_DELEGATIONS);
            return { erc20delegatable, delegationTopic, wrongDelegation, delegations };
        };

        it('should increase after delegate', async () => {
            const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegation);
            let delegationsCount = await erc20delegatable.userDelegationsCount(addr1.address);
            for (const delegation of delegations) {
                await erc20delegatable.delegate(delegation.address, delegatee.address);
                delegationsCount = delegationsCount.add(1);
                expect(await erc20delegatable.userDelegationsCount(addr1.address)).to.equal(delegationsCount);
            }
        });

        it('should decrease after undelegate', async () => {
            const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegation);
            await delegate(delegations, delegatee, addr1, erc20delegatable);
            let delegationsCount = await erc20delegatable.userDelegationsCount(addr1.address);
            for (const delegation of delegations) {
                await erc20delegatable.undelegate(delegation.address);
                delegationsCount = delegationsCount.sub(1);
                expect(await erc20delegatable.userDelegationsCount(addr1.address)).to.equal(delegationsCount);
            }
        });

        it('should not change after redelegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContractsAndDelegation);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            const delegationsCount = await erc20delegatable.userDelegationsCount(addr1.address);
            await erc20delegatable.delegate(delegationTopic.address, newDelegatee.address);
            expect(await erc20delegatable.userDelegationsCount(addr1.address)).to.equal(delegationsCount);
        });
    });

    describe('userDelegationsAt', async () => {
        it('should return delegations', async () => {
            const { erc20delegatable } = await loadFixture(initContracts);
            const delegations = await createDelegations(MAX_USER_DELEGATIONS, erc20delegatable);
            await delegate(delegations, delegatee, addr1, erc20delegatable);
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await erc20delegatable.userDelegationsAt(addr1.address, i)).to.equal(delegations[i].address);
            }
            expect(await erc20delegatable.userDelegationsAt(addr1.address, MAX_USER_DELEGATIONS + 1)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('userDelegations', async () => {
        it('should return delegations', async () => {
            const { erc20delegatable } = await loadFixture(initContracts);
            const delegations = await createDelegations(MAX_USER_DELEGATIONS, erc20delegatable);
            await delegate(delegations, delegatee, addr1, erc20delegatable);
            expect(await erc20delegatable.userDelegations(addr1.address)).to.be.deep.equal(delegations.map(d => d.address));
        });
    });

    describe('delegate', async () => {
        it('should delegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            expect(await erc20delegatable.userIsDelegating(addr1.address, delegationTopic.address)).to.equal(true);
            expect(await delegationTopic.delegated(addr1.address)).to.equal(delegatee.address);
        });

        it('should not delegate more than MAX_USER_DELEGATIONS', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                const delegation = await BasicDelegationTopic.deploy(`DelegationContract${i}`, `DC${i}`);
                await delegation.deployed();
                await delegation.transferOwnership(erc20delegatable.address);
                await erc20delegatable.delegate(delegation.address, delegatee.address);
            }
            await expect(erc20delegatable.delegate(delegationTopic.address, delegatee.address))
                .to.be.revertedWithCustomError(erc20delegatable, 'MaxUserDelegationsReached');
        });

        it('should redelegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            await erc20delegatable.delegate(delegationTopic.address, newDelegatee.address);
            expect(await delegationTopic.delegated(addr1.address)).to.equal(newDelegatee.address);
        });

        it('should redelegate when MAX_USER_DELEGATIONS reached', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            for (let i = 1; i < MAX_USER_DELEGATIONS; i++) {
                const delegation = await BasicDelegationTopic.deploy(`DelegationContract${i}`, `DC${i}`);
                await delegation.deployed();
                await delegation.transferOwnership(erc20delegatable.address);
                await erc20delegatable.delegate(delegation.address, delegatee.address);
            }
            await erc20delegatable.delegate(delegationTopic.address, newDelegatee.address);
            expect(await delegationTopic.delegated(addr1.address)).to.equal(newDelegatee.address);
        });

        it('should not delegate to delegation zero-address', async () => {
            const { erc20delegatable } = await loadFixture(initContracts);
            await expect(erc20delegatable.delegate(constants.ZERO_ADDRESS, delegatee.address))
                .to.be.revertedWithCustomError(erc20delegatable, 'ZeroDelegationAddress');
        });

        it('should not delegate to the same delegatee', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            await expect(erc20delegatable.delegate(delegationTopic.address, delegatee.address))
                .to.be.revertedWithCustomError(erc20delegatable, 'SameDelegateeAssigned');
        });

        it('should increase delegatee\'s balance in delegation contract', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            const amount = BN.from(ether('1'));
            await erc20delegatable.mint(addr1.address, amount);

            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal('0');
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(amount);
        });

        it('should decrease delegatee\'s balance in delegation contract after redelegation to another delegatee', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            const amount = BN.from(ether('1'));
            await erc20delegatable.mint(addr1.address, amount);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);

            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(amount);
            expect(await delegationTopic.balanceOf(newDelegatee.address)).to.equal(0);

            await erc20delegatable.delegate(delegationTopic.address, newDelegatee.address);

            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(0);
            expect(await delegationTopic.balanceOf(newDelegatee.address)).to.equal(amount);
        });

        it('should increase delegatee\'s balance in delegation contract after increasing delegator balance', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            const amount = BN.from(ether('1'));
            const additionalAmount = BN.from(ether('0.5'));
            await erc20delegatable.mint(addr1.address, amount);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);

            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(amount);
            await erc20delegatable.mint(addr1.address, additionalAmount);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(amount.add(additionalAmount));
        });

        it('should decrease delegatee\'s balance in delegation contract after decreasing delegator balance', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContracts);
            const amount = BN.from(ether('1'));
            const additionalAmount = BN.from(ether('0.5'));
            await erc20delegatable.mint(addr1.address, amount);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);

            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(amount);
            await erc20delegatable.transfer(addr2.address, additionalAmount);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(amount.sub(additionalAmount));
        });
    });

    describe('undelegate', async () => {
        async function initContractsAndDelegate () {
            const { erc20delegatable, delegationTopic, wrongDelegation } = await initContracts();
            const amount = BN.from(ether('1'));
            await erc20delegatable.mint(addr1.address, amount);
            await erc20delegatable.delegate(delegationTopic.address, delegatee.address);
            return { erc20delegatable, delegationTopic, wrongDelegation };
        };

        it('should undelegate', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContractsAndDelegate);
            await erc20delegatable.undelegate(delegationTopic.address);
            expect(await erc20delegatable.userIsDelegating(addr1.address, delegationTopic.address)).to.equal(false);
            expect(await delegationTopic.delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
        });

        it('should decrease delegatee\'s balance in delegation contract', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContractsAndDelegate);
            const balanceBefore = await delegationTopic.balanceOf(delegatee.address);
            const delegatorBalance = await erc20delegatable.balanceOf(addr1.address);
            await erc20delegatable.undelegate(delegationTopic.address);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(balanceBefore.sub(delegatorBalance));
        });

        it('should reset delegatee in delegation contract', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContractsAndDelegate);
            await erc20delegatable.undelegate(delegationTopic.address);
            expect(await delegationTopic.delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
        });

        it('should not udelegatee not existed delegation contract', async () => {
            const { erc20delegatable, delegationTopic } = await loadFixture(initContractsAndDelegate);
            await erc20delegatable.undelegate(delegationTopic.address);
            await expect(erc20delegatable.undelegate(delegationTopic.address))
                .to.be.revertedWithCustomError(erc20delegatable, 'DelegationNotExist');
        });

        describe('should not revert when delegation contract methods', async () => {
            async function initContractsAndDelegate2 () {
                const { erc20delegatable, delegationTopic, wrongDelegation } = await initContractsAndDelegate();
                await erc20delegatable.delegate(wrongDelegation.address, delegatee.address);
                return { erc20delegatable, delegationTopic, wrongDelegation };
            };

            it('reverting at setDelegate', async () => {
                const { erc20delegatable, wrongDelegation } = await loadFixture(initContractsAndDelegate2);
                await wrongDelegation.setMethodReverting('setDelegate', true);
                await erc20delegatable.undelegate(wrongDelegation.address);
                expect(await erc20delegatable.userIsDelegating(addr1.address, wrongDelegation.address)).to.equal(false);
            });

            it('has OutOfGas at setDelegate', async () => {
                const { erc20delegatable, wrongDelegation } = await loadFixture(initContractsAndDelegate2);
                await wrongDelegation.setMethodOutOfGas('setDelegate', true);
                await erc20delegatable.undelegate(wrongDelegation.address);
                expect(await erc20delegatable.userIsDelegating(addr1.address, wrongDelegation.address)).to.equal(false);
            });

            it('reverting at updateBalances', async () => {
                const { erc20delegatable, wrongDelegation } = await loadFixture(initContractsAndDelegate2);
                await wrongDelegation.setMethodReverting('updateBalances', true);
                await erc20delegatable.undelegate(wrongDelegation.address);
                expect(await erc20delegatable.userIsDelegating(addr1.address, wrongDelegation.address)).to.equal(false);
            });

            it('has OutOfGas at updateBalances', async () => {
                const { erc20delegatable, wrongDelegation } = await loadFixture(initContractsAndDelegate2);
                await wrongDelegation.setMethodOutOfGas('updateBalances', true);
                await erc20delegatable.undelegate(wrongDelegation.address);
                expect(await erc20delegatable.userIsDelegating(addr1.address, wrongDelegation.address)).to.equal(false);
            });
        });
    });

    describe('undelegateAll', async () => {
        async function initContractsAndDelegations () {
            const { erc20delegatable } = await initContracts();
            const amount = BN.from(ether('1'));
            await erc20delegatable.mint(addr1.address, amount);
            const delegations = await createDelegations(MAX_USER_DELEGATIONS, erc20delegatable);
            await delegate(delegations, delegatee, addr1, erc20delegatable);
            return { erc20delegatable, delegations };
        };

        it('should undelegate all delegations', async () => {
            const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegations);
            await erc20delegatable.undelegateAll();
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await erc20delegatable.userIsDelegating(addr1.address, delegations[i].address)).to.equal(false);
                expect(await delegations[i].delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
            }
        });

        it('should decrease delegatee\'s balance in all delegation contracts', async () => {
            const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegations);
            const delegationBalancesBefore = [];
            const delegatorBalance = await erc20delegatable.balanceOf(addr1.address);
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                delegationBalancesBefore[i] = await delegations[i].balanceOf(delegatee.address);
            }
            await erc20delegatable.undelegateAll();
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegationBalancesBefore[i].sub(delegatorBalance));
                delegationBalancesBefore[i] = await delegations[i].balanceOf(delegatee.address);
            }
        });

        it('should reset delegatee in all delegation contracts', async () => {
            const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegations);
            await erc20delegatable.undelegateAll();
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await delegations[i].delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
            }
        });
    });

    describe('_beforeTokenTransfer', async () => {
        async function initContractsAndDelegations () {
            const { erc20delegatable, wrongDelegation } = await initContracts();
            const addr1Amount = BN.from(ether('1'));
            const addr2Amount = BN.from(ether('2.5'));
            await erc20delegatable.mint(addr1.address, addr1Amount);
            await erc20delegatable.mint(addr2.address, addr2Amount);
            const delegations = await createDelegations(MAX_USER_DELEGATIONS, erc20delegatable);
            await delegate(delegations, delegatee, addr1, erc20delegatable);
            await delegate(delegations, newDelegatee, addr2, erc20delegatable);
            return { erc20delegatable, delegations, wrongDelegation, addr1Amount };
        };

        async function loadBalances (delegations, delegatee, newDelegatee) {
            const delegateeBalancesBefore = [];
            const newDelegateeBalancesBefore = [];
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                delegateeBalancesBefore.push(await delegations[i].balanceOf(delegatee.address));
                newDelegateeBalancesBefore.push(await delegations[i].balanceOf(newDelegatee.address));
            }
            return { delegateeBalancesBefore, newDelegateeBalancesBefore };
        }

        it('should nothing changed when account send tokens to himself', async () => {
            const { erc20delegatable, delegations, addr1Amount } = await loadFixture(initContractsAndDelegations);
            const { delegateeBalancesBefore, newDelegateeBalancesBefore } = await loadBalances(delegations, delegatee, newDelegatee);
            await erc20delegatable.transfer(addr1.address, addr1Amount.div(2));
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegateeBalancesBefore[i]);
                expect(await delegations[i].balanceOf(newDelegatee.address)).to.equal(newDelegateeBalancesBefore[i]);
            }
        });

        it('should nothing changed when account send 0 tokens', async () => {
            const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegations);
            const { delegateeBalancesBefore, newDelegateeBalancesBefore } = await loadBalances(delegations, delegatee, newDelegatee);
            await erc20delegatable.transfer(addr2.address, '0');
            for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegateeBalancesBefore[i]);
                expect(await delegations[i].balanceOf(newDelegatee.address)).to.equal(newDelegateeBalancesBefore[i]);
            }
        });

        describe('should change delegatees balances in delegation contracts correctly after changing accounts balances', async () => {
            it('when both parties are participating the same delegation', async () => {
                const { erc20delegatable, delegations, addr1Amount } = await loadFixture(initContractsAndDelegations);
                const { delegateeBalancesBefore, newDelegateeBalancesBefore } = await loadBalances(delegations, delegatee, newDelegatee);
                const amount = addr1Amount.div(2);
                await erc20delegatable.transfer(addr2.address, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegateeBalancesBefore[i].sub(amount));
                    expect(await delegations[i].balanceOf(newDelegatee.address)).to.equal(newDelegateeBalancesBefore[i].add(amount));
                }
            });

            it('when sender is participating a delegation, but receiver is not', async () => {
                const { erc20delegatable, delegations, addr1Amount } = await loadFixture(initContractsAndDelegations);
                const { delegateeBalancesBefore, newDelegateeBalancesBefore } = await loadBalances(delegations, delegatee, newDelegatee);
                await erc20delegatable.connect(addr2).undelegateAll();
                for (let i = 0; i < delegations.length; i++) {
                    newDelegateeBalancesBefore[i] = await delegations[i].balanceOf(newDelegatee.address);
                }

                const amount = addr1Amount.div(2);
                await erc20delegatable.transfer(addr2.address, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegateeBalancesBefore[i].sub(amount));
                    expect(await delegations[i].balanceOf(newDelegatee.address)).to.equal(newDelegateeBalancesBefore[i]);
                }
            });

            it('when receiver is participating a delegation, but sender is not', async () => {
                const { erc20delegatable, delegations, addr1Amount } = await loadFixture(initContractsAndDelegations);
                const { delegateeBalancesBefore, newDelegateeBalancesBefore } = await loadBalances(delegations, delegatee, newDelegatee);
                await erc20delegatable.undelegateAll();
                for (let i = 0; i < delegations.length; i++) {
                    delegateeBalancesBefore[i] = await delegations[i].balanceOf(delegatee.address);
                }

                const amount = addr1Amount.div(2);
                await erc20delegatable.transfer(addr2.address, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegateeBalancesBefore[i]);
                    expect(await delegations[i].balanceOf(newDelegatee.address)).to.equal(newDelegateeBalancesBefore[i].add(amount));
                }
            });

            it('when both parties are not participating the delegation', async () => {
                const { erc20delegatable, delegations } = await loadFixture(initContractsAndDelegations);
                const { delegateeBalancesBefore, newDelegateeBalancesBefore } = await loadBalances(delegations, delegatee, newDelegatee);

                const amount = BN.from(ether('1'));
                await erc20delegatable.mint(addr3.address, amount);
                await erc20delegatable.connect(addr3).transfer(erc20delegatable.address, amount);
                for (let i = 0; i < MAX_USER_DELEGATIONS; i++) {
                    expect(await delegations[i].balanceOf(delegatee.address)).to.equal(delegateeBalancesBefore[i]);
                    expect(await delegations[i].balanceOf(newDelegatee.address)).to.equal(newDelegateeBalancesBefore[i]);
                }
            });
        });

        async function initContractsAndPrepare () {
            const { erc20delegatable, wrongDelegation, delegations, addr1Amount } = await initContractsAndDelegations();
            await erc20delegatable.undelegate(delegations[0].address);
            await erc20delegatable.connect(addr2).undelegate(delegations[0].address);
            await erc20delegatable.delegate(wrongDelegation.address, delegatee.address);
            await erc20delegatable.connect(addr2).delegate(wrongDelegation.address, newDelegatee.address);
            await wrongDelegation.setMethodReverting('updateBalances', true);
            return { erc20delegatable, addr1Amount };
        };

        describe('should not revert when delegation contract methods reverting', async () => {
            it('when both parties are participating the same delegation', async () => {
                const { erc20delegatable, addr1Amount } = await loadFixture(initContractsAndPrepare);
                await erc20delegatable.transfer(addr2.address, addr1Amount);
            });

            it('when sender is participating a delegation, but receiver is not', async () => {
                const { erc20delegatable, addr1Amount } = await loadFixture(initContractsAndPrepare);
                await erc20delegatable.connect(addr2).undelegateAll();
                await erc20delegatable.transfer(addr2.address, addr1Amount);
            });

            it('when receiver is participating a delegation, but sender is not', async () => {
                const { erc20delegatable, addr1Amount } = await loadFixture(initContractsAndPrepare);
                await erc20delegatable.undelegateAll();
                await erc20delegatable.transfer(addr2.address, addr1Amount);
            });
        });

        describe('should not revert when delegation contract methods has OutOfGas', async () => {
            it('when both parties are participating the same delegation', async () => {
                const { erc20delegatable, addr1Amount } = await loadFixture(initContractsAndPrepare);
                await erc20delegatable.transfer(addr2.address, addr1Amount);
            });

            it('when sender is participating a delegation, but receiver is not', async () => {
                const { erc20delegatable, addr1Amount } = await loadFixture(initContractsAndPrepare);
                await erc20delegatable.connect(addr2).undelegateAll();
                await erc20delegatable.transfer(addr2.address, addr1Amount);
            });

            it('when receiver is participating a delegation, but sender is not', async () => {
                const { erc20delegatable, addr1Amount } = await loadFixture(initContractsAndPrepare);
                await erc20delegatable.undelegateAll();
                await erc20delegatable.transfer(addr2.address, addr1Amount);
            });
        });
    });
});
