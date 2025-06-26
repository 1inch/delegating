const { constants, ether } = require('@1inch/solidity-utils');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { shouldBehaveLikeERC20Hooks } = require('./behaviors/ERC20Hooks.behavior.js');
require('@nomicfoundation/hardhat-chai-matchers');

describe('FarmingDelegationPlugin', function () {
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
            const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
            const delegationPlugin = await FarmingDelegationPlugin.deploy('FarmingDelegationPlugin', 'FDP', delegatedToken, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
            await delegationPlugin.waitForDeployment();
            await delegatedToken.addHook(delegationPlugin);
            await delegationPlugin.register('TestTokenName', 'TestTokenSymbol');
            await delegationPlugin.delegate(addr1);

            const amount = ether('1');
            await delegatedToken.mint(addr1, amount);

            const erc20Hooks = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(addr1));
            // await erc20Hooks.removeHook(await delegationPlugin.defaultFarms(addr1)); // TODO: Uncomment when farming is updated
            const HOOK_COUNT_LIMITS = MAX_SHARE_HOOKS;
            return { erc20Hooks, HOOK_COUNT_LIMITS, amount };
        };

        shouldBehaveLikeERC20Hooks(initContractsBehavior);
    });

    async function initContracts () {
        const Erc20HooksMock = await ethers.getContractFactory('ERC20HooksMock');
        const erc20Hooks = await Erc20HooksMock.deploy('ERC20HooksMock', 'EHM', 5, ERC20_HOOKS_GASLIMIT);
        await erc20Hooks.waitForDeployment();
        const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
        const delegationPlugin = await FarmingDelegationPlugin.deploy('FarmingDelegationPlugin', 'FDP', erc20Hooks, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
        await delegationPlugin.waitForDeployment();
        const amount = ether('1');
        return { erc20Hooks, delegationPlugin, amount };
    };

    async function initContractsAndRegister () {
        const { erc20Hooks, delegationPlugin } = await initContracts();
        await delegationPlugin.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
        return { erc20Hooks, delegationPlugin };
    };

    describe('register', function () {
        describe('register(string,string,uint256)', function () {
            it('should registrate delegatee and create new token', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                expect(await delegationPlugin.registration(delegatee)).to.equal(constants.ZERO_ADDRESS);
                await delegationPlugin.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee));
                expect(await delegatedShare.name()).to.equal('TestTokenName');
                expect(await delegatedShare.symbol()).to.equal('TestTokenSymbol');
            });

            it('should emit Register event', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                await expect(
                    delegationPlugin.connect(delegatee).register('TestTokenName', 'TestTokenSymbol'),
                ).to.emit(
                    delegationPlugin,
                    'RegisterDelegatee',
                ).withArgs(
                    delegatee.address,
                );
            });

            it('should mint and burn DelegatedShare only ReawardableDelegation', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                await delegationPlugin.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee));
                await expect(delegatedShare.mint(addr1, '1000'))
                    .to.be.revertedWithCustomError(delegatedShare, 'NotOwnerPlugin');
                await expect(delegatedShare.burn(addr1, '1000'))
                    .to.be.revertedWithCustomError(delegatedShare, 'NotOwnerPlugin');
            });

            it('should not double registrate', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                await delegationPlugin.connect(delegatee).register('TestTokenName', 'TestTokenSymbol');
                await expect(delegationPlugin.connect(delegatee).register('TestTokenName2', 'TestTokenSymbol2'))
                    .to.be.revertedWithCustomError(delegationPlugin, 'AlreadyRegistered');
            });
        });
    });

    describe('setDefaultFarm', function () {
        it('should set default farm', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee));
            const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
            const farmPlugin = await FarmingDelegationPlugin.deploy('FarmPlugin', 'FRM', delegatedShare, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
            await farmPlugin.waitForDeployment();
            await delegationPlugin.connect(delegatee).setDefaultFarm(farmPlugin);

            expect(await delegationPlugin.defaultFarms(delegatee)).to.equal(await farmPlugin.getAddress());
        });

        it('should not set default farm non-registered user', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            expect(await delegationPlugin.defaultFarms(newDelegatee)).to.equal(constants.ZERO_ADDRESS);
            await expect(delegationPlugin.connect(newDelegatee).setDefaultFarm(constants.EEE_ADDRESS))
                .to.be.revertedWithCustomError(delegationPlugin, 'NotRegisteredDelegatee');
        });

        it('should add default farm for user when delegate', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee));

            const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
            const farmPlugin = await FarmingDelegationPlugin.deploy('FarmPlugin', 'FRM', delegatedShare, MAX_SHARE_HOOKS, SHARE_HOOKS_GASLIMIT);
            await farmPlugin.waitForDeployment();
            await delegationPlugin.connect(delegatee).setDefaultFarm(farmPlugin);

            expect(await delegatedShare.hasHook(addr1, farmPlugin)).to.equal(false);
            await delegationPlugin.delegate(delegatee);
            expect(await delegatedShare.hasHook(addr1, farmPlugin)).to.equal(true);
        });
    });

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            const tx = await delegationPlugin.delegate(delegatee);
            const receipt = await tx.wait();
            expect(await delegationPlugin.delegated(addr1)).to.equal(delegatee.address);
            expect(receipt.logs[0].eventName).to.equal('Delegated');
        });

        it('should not delegate not registered delegatee', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            await expect(delegationPlugin.delegate(newDelegatee))
                .to.be.revertedWithCustomError(delegationPlugin, 'NotRegisteredDelegatee');
        });

        it('should undelegate', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            await delegationPlugin.delegate(delegatee);
            expect(await delegationPlugin.delegated(addr1)).to.equal(delegatee.address);
            await delegationPlugin.delegate(constants.ZERO_ADDRESS);
            expect(await delegationPlugin.delegated(addr1)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndTokens () {
            const { erc20Hooks, delegationPlugin, amount } = await initContracts();
            await erc20Hooks.mint(addr1, amount);
            await erc20Hooks.mint(addr2, amount * 2n);

            await delegationPlugin.connect(delegatee).register('TestTokenName1', 'TestTokenSymbol1');
            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee));

            await delegationPlugin.connect(newDelegatee).register('TestTokenName2', 'TestTokenSymbol2');

            await delegationPlugin.delegate(delegatee);

            return { erc20Hooks, delegationPlugin, delegatedShare, amount };
        };

        it('`address(0) -> addr1` should mint DelegatedShare for addr1', async function () {
            const { erc20Hooks, delegationPlugin, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(0n);
            await erc20Hooks.addHook(delegationPlugin);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(amount);
        });

        it('`addr1 -> address(0)` should burn DelegatedShare for addr1', async function () {
            const { erc20Hooks, delegationPlugin, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            await erc20Hooks.addHook(delegationPlugin);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(amount);
            await erc20Hooks.removeHook(delegationPlugin);
            expect(await delegatedShare.balanceOf(addr1)).to.equal(0n);
        });

        it('`addr1 -> addr2` should change their DelegatedShare balances', async function () {
            const { erc20Hooks, delegationPlugin, amount } = await loadFixture(initContractsAndTokens);
            await erc20Hooks.connect(addr1).addHook(delegationPlugin);
            await erc20Hooks.connect(addr2).addHook(delegationPlugin);
            await delegationPlugin.connect(addr1).delegate(delegatee);
            await delegationPlugin.connect(addr2).delegate(newDelegatee);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee);
            await erc20Hooks.transfer(addr2, transferAmount);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - transferAmount);
            expect(await delegationPlugin.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + transferAmount);
        });
    });
});
