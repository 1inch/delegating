const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe.skip('BasicDelegationPod', function () {
    let addr1, addr2, delegatee, newDelegatee;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    async function initContracts () {
        const BasicDelegationPod = await ethers.getContractFactory('BasicDelegationPod');
        const delegationPod = await BasicDelegationPod.deploy('basic1INCH', 'basic1INCH', addr1.address);
        await delegationPod.deployed();
        return { delegationPod };
    };

    describe.skip('delegate', function () {
        it('should set delegate and emit Delegate event', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            const tx = await delegationPod.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegate');
        });

        it('should set delegate and emit Undelegate event', async function () {
            const { delegationPod } = await loadFixture(initContracts);
            const tx = await delegationPod.delegate(constants.ZERO_ADDRESS);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.be.equals(constants.ZERO_ADDRESS);
            expect(receipt.events[0].event).to.equal('Undelegate');
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegate () {
            const { delegationPod } = await initContracts();
            await delegationPod.delegate(delegatee.address);
            await delegationPod.connect(addr2).delegate(newDelegatee.address);
            const amount = ether('1');
            return { delegationPod, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { delegationPod, amount } = await loadFixture(initContractsAndDelegate);
            const balanceBefore = await delegationPod.balanceOf(delegatee.address);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { delegationPod, amount } = await loadFixture(initContractsAndDelegate);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 5n);
            const balanceBefore = await delegationPod.balanceOf(delegatee.address);
            await delegationPod.updateBalances(addr1.address, constants.ZERO_ADDRESS, amount);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { delegationPod, amount } = await loadFixture(initContractsAndDelegate);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 10n);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr2.address, amount * 20n);
            const balanceBeforeDelegatee = await delegationPod.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPod.balanceOf(newDelegatee.address);
            await delegationPod.updateBalances(addr1.address, addr2.address, amount);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(amount));
            expect(await delegationPod.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(amount));
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
