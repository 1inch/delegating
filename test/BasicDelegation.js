const { expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe('BasicDelegationPod', function () {
    let addr1, addr2, delegatee, newDelegatee;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    async function initContracts () {
        const Erc20PodsMock = await ethers.getContractFactory('ERC20PodsMock');
        const erc20Pods = await Erc20PodsMock.deploy('ERC20PodsMock', 'EPM', 10);
        await erc20Pods.deployed();
        const BasicDelegationPod = await ethers.getContractFactory('BasicDelegationPod');
        const delegationPod = await BasicDelegationPod.deploy('basic1INCH', 'basic1INCH', erc20Pods.address);
        await delegationPod.deployed();
        const amount = ether('1');
        return { erc20Pods, delegationPod, amount };
    };

    async function initAndMint () {
        const { erc20Pods, delegationPod, amount } = await initContracts();
        await erc20Pods.mint(addr1.address, amount);
        return { erc20Pods, delegationPod, amount };
    }

    async function initAndMintAndAddPodWithDelegate () {
        const { erc20Pods, delegationPod, amount } = await initAndMint();
        await erc20Pods.addPod(delegationPod.address);
        await delegationPod.delegate(delegatee.address);
        return { erc20Pods, delegationPod, amount };
    }

    describe('delegate', function () {
        it('should set delegate and emit Delegate event', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            const tx = await delegationPod.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegate');
        });

        it('should does nothing and does not emit Delegate event when the same delegatee', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            await delegationPod.delegate(delegatee.address);
            const tx = await delegationPod.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events.length).to.equal(0);
        });

        it('should not change delegatee balance when users podBalance is 0', async function () {
            const { erc20Pods, delegationPod } = await loadFixture(initAndMint);
            expect(await erc20Pods.podBalanceOf(delegationPod.address, addr1.address)).to.equal('0');
            const delegateeBalanceBefore = await delegationPod.balanceOf(delegatee.address);
            await delegationPod.delegate(delegatee.address);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(delegateeBalanceBefore);
        });

        it('should increase delegatee balance when users podBalance is not 0', async function () {
            const { erc20Pods, delegationPod, amount } = await loadFixture(initAndMint);
            await erc20Pods.addPod(delegationPod.address);
            expect(await erc20Pods.podBalanceOf(delegationPod.address, addr1.address)).to.equal(amount);
            const delegateeBalanceBefore = await delegationPod.balanceOf(delegatee.address);
            await delegationPod.delegate(delegatee.address);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(delegateeBalanceBefore.add(amount));
        });

        it('should increase new delegatee balance and decrease prev delegatee balance when user redelegate', async function () {
            const { delegationPod, amount } = await loadFixture(initAndMintAndAddPodWithDelegate);
            const balanceBeforeDelegatee = await delegationPod.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPod.balanceOf(newDelegatee.address);
            await delegationPod.delegate(newDelegatee.address);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(amount));
            expect(await delegationPod.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(amount));
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegateWithWallets () {
            const { erc20Pods, delegationPod, amount } = await initContracts();
            await erc20Pods.mint(addr1.address, amount);
            await erc20Pods.mint(addr2.address, amount * 2n);
            await erc20Pods.connect(addr1).addPod(delegationPod.address);
            await erc20Pods.connect(addr2).addPod(delegationPod.address);
            await delegationPod.connect(addr1).delegate(delegatee.address);
            await delegationPod.connect(addr2).delegate(newDelegatee.address);
            return { erc20Pods, delegationPod, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { erc20Pods, delegationPod, amount } = await loadFixture(initAndMint);
            await delegationPod.delegate(delegatee.address);
            const balanceBefore = await delegationPod.balanceOf(delegatee.address);
            await erc20Pods.addPod(delegationPod.address);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { erc20Pods, delegationPod, amount } = await loadFixture(initAndMint);
            await delegationPod.delegate(delegatee.address);
            await erc20Pods.addPod(delegationPod.address);
            const balanceBefore = await delegationPod.balanceOf(delegatee.address);
            await erc20Pods.removePod(delegationPod.address);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { erc20Pods, delegationPod, amount } = await loadFixture(initContractsAndDelegateWithWallets);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPod.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPod.balanceOf(newDelegatee.address);
            await erc20Pods.transfer(addr2.address, transferAmount);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(transferAmount));
            expect(await delegationPod.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(transferAmount));
        });
    });

    describe('ERC20 overrides', function () {
        it('should not transfer', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            await expect(delegationPod.transfer(addr2.address, ether('1')))
                .to.be.revertedWithCustomError(delegationPod, 'MethodDisabled');
        });

        it('should not transferFrom', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            await expect(delegationPod.transferFrom(addr2.address, delegatee.address, ether('1')))
                .to.be.revertedWithCustomError(delegationPod, 'MethodDisabled');
        });

        it('should not approve', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            await expect(delegationPod.approve(addr2.address, ether('1')))
                .to.be.revertedWithCustomError(delegationPod, 'MethodDisabled');
        });
    });
});
