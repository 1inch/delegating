const { ether } = require('@1inch/solidity-utils');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
require('@nomicfoundation/hardhat-chai-matchers');

describe('DelegationPlugin', function () {
    let addr1, addr2, delegatee, newDelegatee;
    const ERC20_HOOKS_GASLIMIT = 500000;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    async function initContracts () {
        const Erc20HooksMock = await ethers.getContractFactory('ERC20HooksMock');
        const erc20Hooks = await Erc20HooksMock.deploy('ERC20HooksMock', 'EHM', 5, ERC20_HOOKS_GASLIMIT);
        await erc20Hooks.waitForDeployment();
        const DelegationPlugin = await ethers.getContractFactory('DelegationPlugin');
        const delegationPlugin = await DelegationPlugin.deploy('basic1INCH', 'basic1INCH', erc20Hooks);
        await delegationPlugin.waitForDeployment();
        const amount = ether('1');
        return { erc20Hooks, delegationPlugin, amount };
    };

    async function initAndMint () {
        const { erc20Hooks, delegationPlugin, amount } = await initContracts();
        await erc20Hooks.mint(addr1, amount);
        return { erc20Hooks, delegationPlugin, amount };
    }

    async function initAndMintAndAddHookWithDelegate () {
        const { erc20Hooks, delegationPlugin, amount } = await initAndMint();
        await erc20Hooks.addHook(delegationPlugin);
        await delegationPlugin.delegate(delegatee);
        return { erc20Hooks, delegationPlugin, amount };
    }

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            const tx = await delegationPlugin.delegate(delegatee);
            const receipt = await tx.wait();
            expect(await delegationPlugin.delegated(addr1)).to.equal(delegatee.address);
            expect(receipt.logs[0].eventName).to.equal('Delegated');
        });

        it('should does nothing and does not emit Delegated event when the same delegatee', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await delegationPlugin.delegate(delegatee);
            const tx = await delegationPlugin.delegate(delegatee);
            const receipt = await tx.wait();
            expect(await delegationPlugin.delegated(addr1)).to.equal(delegatee.address);
            expect(receipt.logs.length).to.equal(0);
        });

        it('should not change delegatee balance when users hookBalance is 0', async function () {
            const { erc20Hooks, delegationPlugin } = await loadFixture(initAndMint);
            expect(await erc20Hooks.hookBalanceOf(delegationPlugin, addr1)).to.equal(0n);
            const delegateeBalanceBefore = await delegationPlugin.balanceOf(delegatee);
            await delegationPlugin.delegate(delegatee);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(delegateeBalanceBefore);
        });

        it('should increase delegatee balance when users hookBalance is not 0', async function () {
            const { erc20Hooks, delegationPlugin, amount } = await loadFixture(initAndMint);
            await erc20Hooks.addHook(delegationPlugin);
            expect(await erc20Hooks.hookBalanceOf(delegationPlugin, addr1)).to.equal(amount);
            const delegateeBalanceBefore = await delegationPlugin.balanceOf(delegatee);
            await delegationPlugin.delegate(delegatee);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(delegateeBalanceBefore + amount);
        });

        it('should increase new delegatee balance and decrease prev delegatee balance when user redelegate', async function () {
            const { delegationPlugin, amount } = await loadFixture(initAndMintAndAddHookWithDelegate);
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee);
            await delegationPlugin.delegate(newDelegatee);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - amount);
            expect(await delegationPlugin.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + amount);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegateWithWallets () {
            const { erc20Hooks, delegationPlugin, amount } = await initContracts();
            await erc20Hooks.mint(addr1, amount);
            await erc20Hooks.mint(addr2, amount * 2n);
            await erc20Hooks.connect(addr1).addHook(delegationPlugin);
            await erc20Hooks.connect(addr2).addHook(delegationPlugin);
            await delegationPlugin.connect(addr1).delegate(delegatee);
            await delegationPlugin.connect(addr2).delegate(newDelegatee);
            return { erc20Hooks, delegationPlugin, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { erc20Hooks, delegationPlugin, amount } = await loadFixture(initAndMint);
            await delegationPlugin.delegate(delegatee);
            const balanceBefore = await delegationPlugin.balanceOf(delegatee);
            await erc20Hooks.addHook(delegationPlugin);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBefore + amount);
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { erc20Hooks, delegationPlugin, amount } = await loadFixture(initAndMint);
            await delegationPlugin.delegate(delegatee);
            await erc20Hooks.addHook(delegationPlugin);
            const balanceBefore = await delegationPlugin.balanceOf(delegatee);
            await erc20Hooks.removeHook(delegationPlugin);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBefore - amount);
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { erc20Hooks, delegationPlugin, amount } = await loadFixture(initContractsAndDelegateWithWallets);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee);
            await erc20Hooks.transfer(addr2, transferAmount);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - transferAmount);
            expect(await delegationPlugin.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + transferAmount);
        });
    });

    describe('ERC20 overrides', function () {
        it('should not transfer', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await expect(delegationPlugin.transfer(addr2, ether('1')))
                .to.be.revertedWithCustomError(delegationPlugin, 'TransferDisabled');
        });

        it('should not transferFrom', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await expect(delegationPlugin.transferFrom(addr2, delegatee, ether('1')))
                .to.be.revertedWithCustomError(delegationPlugin, 'TransferDisabled');
        });

        it('should not approve', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await expect(delegationPlugin.approve(addr2, ether('1')))
                .to.be.revertedWithCustomError(delegationPlugin, 'ApproveDisabled');
        });
    });
});
