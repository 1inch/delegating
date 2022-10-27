const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe('BasicDelegationTopic', function () {
    let addr1, addr2, delegatee, newDelegatee;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    async function initContracts () {
        const BasicDelegationTopic = await ethers.getContractFactory('BasicDelegationTopic');
        const delegationTopic = await BasicDelegationTopic.deploy('basic1INCH', 'basic1INCH');
        await delegationTopic.deployed();
        return { delegationTopic };
    };

    describe('setDelegate', function () {
        it('should set delegate and emit Delegate event', async function () {
            const { delegationTopic } = await loadFixture(initContracts);
            const tx = await delegationTopic.setDelegate(addr1.address, delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationTopic.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegate');
        });

        it('should set delegate and emit Undelegate event', async function () {
            const { delegationTopic } = await loadFixture(initContracts);
            const tx = await delegationTopic.setDelegate(addr1.address, constants.ZERO_ADDRESS);
            const receipt = await tx.wait();
            expect(await delegationTopic.delegated(addr1.address)).to.be.equals(constants.ZERO_ADDRESS);
            expect(receipt.events[0].event).to.equal('Undelegate');
        });

        it('should delegate by only owner', async function () {
            const { delegationTopic } = await loadFixture(initContracts);
            await expect(delegationTopic.connect(addr2).setDelegate(addr1.address, delegatee.address))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndDelegate () {
            const { delegationTopic } = await initContracts();
            await delegationTopic.setDelegate(addr1.address, delegatee.address);
            await delegationTopic.setDelegate(addr2.address, newDelegatee.address);
            const amount = ether('1');
            return { delegationTopic, amount };
        }

        it('`address(0) -> addr1` should increase delegatee balance', async function () {
            const { delegationTopic, amount } = await loadFixture(initContractsAndDelegate);
            const balanceBefore = await delegationTopic.balanceOf(delegatee.address);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async function () {
            const { delegationTopic, amount } = await loadFixture(initContractsAndDelegate);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 5n);
            const balanceBefore = await delegationTopic.balanceOf(delegatee.address);
            await delegationTopic.updateBalances(addr1.address, constants.ZERO_ADDRESS, amount);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change delegatee balances', async function () {
            const { delegationTopic, amount } = await loadFixture(initContractsAndDelegate);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 10n);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr2.address, amount * 20n);
            const balanceBeforeDelegatee = await delegationTopic.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationTopic.balanceOf(newDelegatee.address);
            await delegationTopic.updateBalances(addr1.address, addr2.address, amount);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(amount));
            expect(await delegationTopic.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(amount));
        });
    });

    describe('ERC20 overrides', function () {
        it('should not transfer', async function () {
            const { delegationTopic } = await loadFixture(initContracts);
            await expect(delegationTopic.transfer(addr2.address, ether('1')))
                .to.be.revertedWithCustomError(delegationTopic, 'MethodDisabled');
        });

        it('should not transferFrom', async function () {
            const { delegationTopic } = await loadFixture(initContracts);
            await expect(delegationTopic.transferFrom(addr2.address, delegatee.address, ether('1')))
                .to.be.revertedWithCustomError(delegationTopic, 'MethodDisabled');
        });

        it('should not approve', async function () {
            const { delegationTopic } = await loadFixture(initContracts);
            await expect(delegationTopic.approve(addr2.address, ether('1')))
                .to.be.revertedWithCustomError(delegationTopic, 'MethodDisabled');
        });
    });
});
