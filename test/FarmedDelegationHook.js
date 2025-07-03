const { constants, ether } = require('@1inch/solidity-utils');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { shouldBehaveLikeERC20Hooks } = require('./behaviors/ERC20Hooks.behavior.js');
require('@nomicfoundation/hardhat-chai-matchers');

describe('FarmingDelegationHook', function () {
    let addr1, addr2, delegatee, newDelegatee;
    const MAX_SHARE_HOOKS = 3;
    const SHARE_HOOKS_GASLIMIT = 150000;
    const ERC20_HOOKS_GASLIMIT = 500000;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    describe('shouldBehaveLikeERC20Hooks', function () {
        async function initContractsBehavior () {
            const Erc20HooksMock = await ethers.getContractFactory('ERC20HooksMock');
            const delegatedToken = await Erc20HooksMock.deploy('ERC20HooksMock', 'EHM', 5, ERC20_HOOKS_GASLIMIT);
            await delegatedToken.waitForDeployment();
            const FarmingDelegationHook = await ethers.getContractFactory('FarmingDelegationHook');
            const delegationHook = await FarmingDelegationHook.deploy('FarmingDelegationHook', 'FDH', delegatedToken, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
            await delegationHook.waitForDeployment();
            await delegatedToken.addHook(delegationHook);
            await delegationHook.register('TestTokenName', 'TestTokenSymbol');
            await delegationHook.delegate(addr1);

            const amount = ether('1');
            await delegatedToken.mint(addr1, amount);

            const erc20Hooks = await ethers.getContractAt('DelegatedShare', await delegationHook.registration(addr1));
            // await erc20Hooks.removeHook(await delegationHook.defaultFarms(addr1)); // TODO: Uncomment when farming is updated
            const HOOK_COUNT_LIMITS = MAX_SHARE_HOOKS;
            return { erc20Hooks, HOOK_COUNT_LIMITS, amount };
        };

        shouldBehaveLikeERC20Hooks(initContractsBehavior);
    });

    async function initContracts () {
        const Erc20HooksMock = await ethers.getContractFactory('ERC20HooksMock');
        const erc20Hooks = await Erc20HooksMock.deploy('ERC20HooksMock', 'EHM', 5, ERC20_HOOKS_GASLIMIT);
        await erc20Hooks.waitForDeployment();
        const FarmingDelegationHook = await ethers.getContractFactory('FarmingDelegationHook');
        const delegationHook = await FarmingDelegationHook.deploy('FarmingDelegationHook', 'FDH', erc20Hooks, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
        await delegationHook.waitForDeployment();
        const amount = ether('1');
        return { erc20Hooks, delegationHook, amount };
    };

    async function initContractsAndRegister () {
        const { erc20Hooks, delegationHook } = await initContracts();
        await delegationHook.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
        return { erc20Hooks, delegationHook };
    };

    describe('register', function () {
        describe('register(string,string,uint256)', function () {
            it('should registrate delegatee and create new token', async function () {
                const { delegationHook } = await loadFixture(initContracts);
                expect(await delegationHook.registration(delegatee)).to.equal(constants.ZERO_ADDRESS);
                await delegationHook.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationHook.registration(delegatee));
                expect(await delegatedShare.name()).to.equal('TestTokenName');
                expect(await delegatedShare.symbol()).to.equal('TestTokenSymbol');
            });

            it('should emit Register event', async function () {
                const { delegationHook } = await loadFixture(initContracts);
                await expect(
                    delegationHook.connect(delegatee).register('TestTokenName', 'TestTokenSymbol'),
                ).to.emit(
                    delegationHook,
                    'RegisterDelegatee',
                ).withArgs(
                    delegatee.address,
                );
            });

            it('should mint and burn DelegatedShare only ReawardableDelegation', async function () {
                const { delegationHook } = await loadFixture(initContracts);
                await delegationHook.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationHook.registration(delegatee));
                await expect(delegatedShare.mint(addr1, '1000'))
                    .to.be.revertedWithCustomError(delegatedShare, 'NotOwnerHook');
                await expect(delegatedShare.burn(addr1, '1000'))
                    .to.be.revertedWithCustomError(delegatedShare, 'NotOwnerHook');
            });

            it('should not double registrate', async function () {
                const { delegationHook } = await loadFixture(initContracts);
                await delegationHook.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
                await expect(delegationHook.connect(delegatee).register('TestTokenName2', 'TestTokenSymbol2'))
                    .to.be.revertedWithCustomError(delegationHook, 'AlreadyRegistered');
            });
        });
    });

    describe('setDefaultFarm', function () {
        it('should set default farm', async function () {
            const { delegationHook } = await loadFixture(initContractsAndRegister);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationHook.registration(delegatee));
            const FarmingDelegationHook = await ethers.getContractFactory('FarmingDelegationHook');
            const farmHook = await FarmingDelegationHook.deploy('FarmHook', 'FRM', delegatedShare, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
            await farmHook.waitForDeployment();
            await delegationHook.connect(delegatee).setDefaultFarm(farmHook);

            expect(await delegationHook.defaultFarms(delegatee)).to.equal(await farmHook.getAddress());
        });

        it('should not set default farm non-registered user', async function () {
            const { delegationHook } = await loadFixture(initContractsAndRegister);
            expect(await delegationHook.defaultFarms(newDelegatee)).to.equal(constants.ZERO_ADDRESS);
            await expect(delegationHook.connect(newDelegatee).setDefaultFarm(constants.EEE_ADDRESS))
                .to.be.revertedWithCustomError(delegationHook, 'NotRegisteredDelegatee');
        });

        it('should add default farm for user when delegate', async function () {
            const { delegationHook } = await loadFixture(initContractsAndRegister);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationHook.registration(delegatee));

            const FarmingDelegationHook = await ethers.getContractFactory('FarmingDelegationHook');
            const farmHook = await FarmingDelegationHook.deploy('FarmHook', 'FRM', delegatedShare, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
            await farmHook.waitForDeployment();
            await delegationHook.connect(delegatee).setDefaultFarm(farmHook);

            expect(await delegatedShare.hasHook(addr1, farmHook)).to.equal(false);
            await delegationHook.delegate(delegatee);
            expect(await delegatedShare.hasHook(addr1, farmHook)).to.equal(true);
        });
    });

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationHook } = await loadFixture(initContractsAndRegister);
            const tx = await delegationHook.delegate(delegatee);
            const receipt = await tx.wait();
            expect(await delegationHook.delegated(addr1)).to.equal(delegatee.address);
            expect(receipt.logs[0].eventName).to.equal('Delegated');
        });

        it('should not delegate not registered delegatee', async function () {
            const { delegationHook } = await loadFixture(initContractsAndRegister);
            await expect(delegationHook.delegate(newDelegatee))
                .to.be.revertedWithCustomError(delegationHook, 'NotRegisteredDelegatee');
        });

        it('should undelegate', async function () {
            const { delegationHook } = await loadFixture(initContractsAndRegister);
            await delegationHook.delegate(delegatee);
            expect(await delegationHook.delegated(addr1)).to.equal(delegatee.address);
            await delegationHook.delegate(constants.ZERO_ADDRESS);
            expect(await delegationHook.delegated(addr1)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndTokens () {
            const { erc20Hooks, delegationHook, amount } = await initContracts();
            await erc20Hooks.mint(addr1, amount);
            await erc20Hooks.mint(addr2, amount * 2n);

            await delegationHook.connect(delegatee).register('TestTokenName1', 'TestTokenSymbol1');
            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationHook.registration(delegatee));

            await delegationHook.connect(newDelegatee).register('TestTokenName2', 'TestTokenSymbol2');

            await delegationHook.delegate(delegatee);

            return { erc20Hooks, delegationHook, delegatedShare, amount };
        };

        it('`address(0) -> addr1` should mint DelegatedShare for addr1', async function () {
            const { erc20Hooks, delegationHook, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(0n);
            await erc20Hooks.addHook(delegationHook);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(amount);
        });

        it('`addr1 -> address(0)` should burn DelegatedShare for addr1', async function () {
            const { erc20Hooks, delegationHook, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            await erc20Hooks.addHook(delegationHook);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(amount);
            await erc20Hooks.removeHook(delegationHook);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(0n);
        });

        it('`addr1 -> addr2` should change their DelegatedShare balances', async function () {
            const { erc20Hooks, delegationHook, amount } = await loadFixture(initContractsAndTokens);
            await erc20Hooks.connect(addr1).addHook(delegationHook);
            await erc20Hooks.connect(addr2).addHook(delegationHook);
            await delegationHook.connect(addr1).delegate(delegatee);
            await delegationHook.connect(addr2).delegate(newDelegatee);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationHook.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationHook.balanceOf(newDelegatee);
            await erc20Hooks.transfer(addr2, transferAmount);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - transferAmount);
            expect(await delegationHook.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + transferAmount);
        });
    });
});
