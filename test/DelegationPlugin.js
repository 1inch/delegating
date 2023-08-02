const { expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe('DelegationPlugin', function () {
    let addr1, addr2, delegatee, newDelegatee;
    const ERC20_PLUGINS_GASLIMIT = 500000;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    async function initContracts () {
        const Erc20PluginsMock = await ethers.getContractFactory('ERC20PluginsMock');
        const erc20Plugins = await Erc20PluginsMock.deploy('ERC20PluginsMock', 'EPM', 5, ERC20_PLUGINS_GASLIMIT);
        await erc20Plugins.waitForDeployment();
        const DelegationPlugin = await ethers.getContractFactory('DelegationPlugin');
        const delegationPlugin = await DelegationPlugin.deploy('basic1INCH', 'basic1INCH', erc20Plugins);
        await delegationPlugin.waitForDeployment();
        const amount = ether('1');
        return { erc20Plugins, delegationPlugin, amount };
    };

    async function initAndMint () {
        const { erc20Plugins, delegationPlugin, amount } = await initContracts();
        await erc20Plugins.mint(addr1, amount);
        return { erc20Plugins, delegationPlugin, amount };
    }

    async function initAndMintAndAddPluginWithDelegate () {
        const { erc20Plugins, delegationPlugin, amount } = await initAndMint();
        await erc20Plugins.addPlugin(delegationPlugin);
        await delegationPlugin.delegate(delegatee);
        return { erc20Plugins, delegationPlugin, amount };
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

        it('should not change delegatee balance when users pluginBalance is 0', async function () {
            const { erc20Plugins, delegationPlugin } = await loadFixture(initAndMint);
            expect(await erc20Plugins.pluginBalanceOf(delegationPlugin, addr1)).to.equal('0');
            const delegateeBalanceBefore = await delegationPlugin.balanceOf(delegatee);
            await delegationPlugin.delegate(delegatee);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(delegateeBalanceBefore);
        });

        it('should increase delegatee balance when users pluginBalance is not 0', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initAndMint);
            await erc20Plugins.addPlugin(delegationPlugin);
            expect(await erc20Plugins.pluginBalanceOf(delegationPlugin, addr1)).to.equal(amount);
            const delegateeBalanceBefore = await delegationPlugin.balanceOf(delegatee);
            await delegationPlugin.delegate(delegatee);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(delegateeBalanceBefore + amount);
        });

        it('should increase new delegatee balance and decrease prev delegatee balance when user redelegate', async function () {
            const { delegationPlugin, amount } = await loadFixture(initAndMintAndAddPluginWithDelegate);
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee);
            await delegationPlugin.delegate(newDelegatee);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBeforeDelegatee - amount);
            expect(await delegationPlugin.balanceOf(newDelegatee)).to.equal(balanceBeforeNewDelegatee + amount);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegateWithWallets () {
            const { erc20Plugins, delegationPlugin, amount } = await initContracts();
            await erc20Plugins.mint(addr1, amount);
            await erc20Plugins.mint(addr2, amount * 2n);
            await erc20Plugins.connect(addr1).addPlugin(delegationPlugin);
            await erc20Plugins.connect(addr2).addPlugin(delegationPlugin);
            await delegationPlugin.connect(addr1).delegate(delegatee);
            await delegationPlugin.connect(addr2).delegate(newDelegatee);
            return { erc20Plugins, delegationPlugin, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initAndMint);
            await delegationPlugin.delegate(delegatee);
            const balanceBefore = await delegationPlugin.balanceOf(delegatee);
            await erc20Plugins.addPlugin(delegationPlugin);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBefore + amount);
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initAndMint);
            await delegationPlugin.delegate(delegatee);
            await erc20Plugins.addPlugin(delegationPlugin);
            const balanceBefore = await delegationPlugin.balanceOf(delegatee);
            await erc20Plugins.removePlugin(delegationPlugin);
            expect(await delegationPlugin.balanceOf(delegatee)).to.equal(balanceBefore - amount);
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initContractsAndDelegateWithWallets);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee);
            await erc20Plugins.transfer(addr2, transferAmount);
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
