const { ether } = require('@1inch/solidity-utils');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
require('@nomicfoundation/hardhat-chai-matchers');

describe('DelegationHook', function () {
    let addr1, addr2, delegatee, newDelegatee;
    const ERC20_HOOKS_GASLIMIT = 500000;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    async function initContracts () {
        const Erc20HooksMock = await ethers.getContractFactory('ERC20HooksMock');
        const erc20Hooks = await Erc20HooksMock.deploy('ERC20HooksMock', 'EHM', 5, ERC20_HOOKS_GASLIMIT);
        await erc20Hooks.waitForDeployment();
        const DelegationHook = await ethers.getContractFactory('DelegationHook');
        const delegationHook = await DelegationHook.deploy('basic1INCH', 'basic1INCH', erc20Hooks);
        await delegationHook.waitForDeployment();
        const amount = ether('1');
        return { erc20Hooks, delegationHook, amount };
    };

    async function initAndMint () {
        const { erc20Hooks, delegationHook, amount } = await initContracts();
        await erc20Hooks.mint(addr1, amount);
        return { erc20Hooks, delegationHook, amount };
    }

    async function initAndMintAndAddHookWithDelegate () {
        const { erc20Hooks, delegationHook, amount } = await initAndMint();
        await erc20Hooks.addHook(delegationHook);
        await delegationHook.delegate(delegatee);
        return { erc20Hooks, delegationHook, amount };
    }

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationHook } = await loadFixture(initContracts);
            const tx = await delegationHook.delegate(delegatee);
            const receipt = await tx.wait();
            expect(await delegationHook.delegated(addr1)).to.equal(delegatee.address);
            expect(receipt.logs[0].eventName).to.equal('Delegated');
        });

        it('should does nothing and does not emit Delegated event when the same delegatee', async function () {
            const { delegationHook } = await loadFixture(initContracts);
            await delegationHook.delegate(delegatee);
            const tx = await delegationHook.delegate(delegatee);
            const receipt = await tx.wait();
            expect(await delegationHook.delegated(addr1)).to.equal(delegatee.address);
            expect(receipt.logs.length).to.equal(0);
        });

        it('should not change delegatee balance when users hookBalance is 0', async function () {
            const { erc20Hooks, delegationHook } = await loadFixture(initAndMint);
            expect(await erc20Hooks.hookBalanceOf(delegationHook, addr1)).to.equal(0n);
            const delegateeBalanceBefore = await delegationHook.balanceOf(delegatee);
            await delegationHook.delegate(delegatee);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(delegateeBalanceBefore);
        });

        it('should increase delegatee balance when users hookBalance is not 0', async function () {
            const { erc20Hooks, delegationHook, amount } = await loadFixture(initAndMint);
            await erc20Hooks.addHook(delegationHook);
            expect(await erc20Hooks.hookBalanceOf(delegationHook, addr1)).to.equal(amount);
            const delegateeBalanceBefore = await delegationHook.balanceOf(delegatee);
            await delegationHook.delegate(delegatee);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(delegateeBalanceBefore + amount);
        });

        it('should increase new delegatee balance and decrease prev delegatee balance when user redelegate', async function () {
            const { delegationHook, amount } = await loadFixture(initAndMintAndAddHookWithDelegate);
            const balanceBeforeDelegatee = await delegationHook.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationHook.balanceOf(newDelegatee);
            await delegationHook.delegate(newDelegatee);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - amount);
            expect(await delegationHook.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + amount);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegateWithWallets () {
            const { erc20Hooks, delegationHook, amount } = await initContracts();
            await erc20Hooks.mint(addr1, amount);
            await erc20Hooks.mint(addr2, amount * 2n);
            await erc20Hooks.connect(addr1).addHook(delegationHook);
            await erc20Hooks.connect(addr2).addHook(delegationHook);
            await delegationHook.connect(addr1).delegate(delegatee);
            await delegationHook.connect(addr2).delegate(newDelegatee);
            return { erc20Hooks, delegationHook, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { erc20Hooks, delegationHook, amount } = await loadFixture(initAndMint);
            await delegationHook.delegate(delegatee);
            const balanceBefore = await delegationHook.balanceOf(delegatee);
            await erc20Hooks.addHook(delegationHook);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(balanceBefore + amount);
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { erc20Hooks, delegationHook, amount } = await loadFixture(initAndMint);
            await delegationHook.delegate(delegatee);
            await erc20Hooks.addHook(delegationHook);
            const balanceBefore = await delegationHook.balanceOf(delegatee);
            await erc20Hooks.removeHook(delegationHook);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(balanceBefore - amount);
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { erc20Hooks, delegationHook, amount } = await loadFixture(initContractsAndDelegateWithWallets);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationHook.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationHook.balanceOf(newDelegatee);
            await erc20Hooks.transfer(addr2, transferAmount);
            expect(await delegationHook.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - transferAmount);
            expect(await delegationHook.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + transferAmount);
        });
    });

    describe('ERC20 overrides', function () {
        it('should not transfer', async function () {
            const { delegationHook } = await loadFixture(initContracts);
            await expect(delegationHook.transfer(addr2, ether('1')))
                .to.be.revertedWithCustomError(delegationHook, 'TransferDisabled');
        });

        it('should not transferFrom', async function () {
            const { delegationHook } = await loadFixture(initContracts);
            await expect(delegationHook.transferFrom(addr2, delegatee, ether('1')))
                .to.be.revertedWithCustomError(delegationHook, 'TransferDisabled');
        });

        it('should not approve', async function () {
            const { delegationHook } = await loadFixture(initContracts);
            await expect(delegationHook.approve(addr2, ether('1')))
                .to.be.revertedWithCustomError(delegationHook, 'ApproveDisabled');
        });
    });
});
