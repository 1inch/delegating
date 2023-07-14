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
        await erc20Plugins.deployed();
        const DelegationPlugin = await ethers.getContractFactory('DelegationPlugin');
        const delegationPlugin = await DelegationPlugin.deploy('basic1INCH', 'basic1INCH', erc20Plugins.address);
        await delegationPlugin.deployed();
        const amount = ether('1');
        return { erc20Plugins, delegationPlugin, amount };
    };

    async function initAndMint () {
        const { erc20Plugins, delegationPlugin, amount } = await initContracts();
        await erc20Plugins.mint(addr1.address, amount);
        return { erc20Plugins, delegationPlugin, amount };
    }

    async function initAndMintAndAddPluginWithDelegate () {
        const { erc20Plugins, delegationPlugin, amount } = await initAndMint();
        await erc20Plugins.addPlugin(delegationPlugin.address);
        await delegationPlugin.delegate(delegatee.address);
        return { erc20Plugins, delegationPlugin, amount };
    }

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            const tx = await delegationPlugin.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPlugin.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegated');
        });

        it('should does nothing and does not emit Delegated event when the same delegatee', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await delegationPlugin.delegate(delegatee.address);
            const tx = await delegationPlugin.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPlugin.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events.length).to.equal(0);
        });

        it('should not change delegatee balance when users pluginBalance is 0', async function () {
            const { erc20Plugins, delegationPlugin } = await loadFixture(initAndMint);
            expect(await erc20Plugins.pluginBalanceOf(delegationPlugin.address, addr1.address)).to.equal('0');
            const delegateeBalanceBefore = await delegationPlugin.balanceOf(delegatee.address);
            await delegationPlugin.delegate(delegatee.address);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(delegateeBalanceBefore);
        });

        it('should increase delegatee balance when users pluginBalance is not 0', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initAndMint);
            await erc20Plugins.addPlugin(delegationPlugin.address);
            expect(await erc20Plugins.pluginBalanceOf(delegationPlugin.address, addr1.address)).to.equal(amount);
            const delegateeBalanceBefore = await delegationPlugin.balanceOf(delegatee.address);
            await delegationPlugin.delegate(delegatee.address);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(delegateeBalanceBefore.add(amount));
        });

        it('should increase new delegatee balance and decrease prev delegatee balance when user redelegate', async function () {
            const { delegationPlugin, amount } = await loadFixture(initAndMintAndAddPluginWithDelegate);
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee.address);
            await delegationPlugin.delegate(newDelegatee.address);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(amount));
            expect(await delegationPlugin.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(amount));
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegateWithWallets () {
            const { erc20Plugins, delegationPlugin, amount } = await initContracts();
            await erc20Plugins.mint(addr1.address, amount);
            await erc20Plugins.mint(addr2.address, amount * 2n);
            await erc20Plugins.connect(addr1).addPlugin(delegationPlugin.address);
            await erc20Plugins.connect(addr2).addPlugin(delegationPlugin.address);
            await delegationPlugin.connect(addr1).delegate(delegatee.address);
            await delegationPlugin.connect(addr2).delegate(newDelegatee.address);
            return { erc20Plugins, delegationPlugin, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initAndMint);
            await delegationPlugin.delegate(delegatee.address);
            const balanceBefore = await delegationPlugin.balanceOf(delegatee.address);
            await erc20Plugins.addPlugin(delegationPlugin.address);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initAndMint);
            await delegationPlugin.delegate(delegatee.address);
            await erc20Plugins.addPlugin(delegationPlugin.address);
            const balanceBefore = await delegationPlugin.balanceOf(delegatee.address);
            await erc20Plugins.removePlugin(delegationPlugin.address);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initContractsAndDelegateWithWallets);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee.address);
            await erc20Plugins.transfer(addr2.address, transferAmount);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(transferAmount));
            expect(await delegationPlugin.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(transferAmount));
        });
    });

    describe('ERC20 overrides', function () {
        it('should not transfer', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await expect(delegationPlugin.transfer(addr2.address, ether('1')))
                .to.be.revertedWithCustomError(delegationPlugin, 'TransferDisabled');
        });

        it('should not transferFrom', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await expect(delegationPlugin.transferFrom(addr2.address, delegatee.address, ether('1')))
                .to.be.revertedWithCustomError(delegationPlugin, 'TransferDisabled');
        });

        it('should not approve', async function () {
            const { delegationPlugin } = await loadFixture(initContracts);
            await expect(delegationPlugin.approve(addr2.address, ether('1')))
                .to.be.revertedWithCustomError(delegationPlugin, 'ApproveDisabled');
        });
    });
});
