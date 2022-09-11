const { constants, expect, ether } = require('@1inch/solidity-utils');
const { artifacts } = require('hardhat');

const VotingDelegation = artifacts.require('VotingDelegation');

describe('VotingDelegation', async () => {
    let addr1, addr2, delegatee, newDelegatee;

    before(async () => {
        [addr1, addr2, delegatee, newDelegatee] = await web3.eth.getAccounts();
    });

    beforeEach(async () => {
        this.votingDelegation = await VotingDelegation.new('vote1INCH', 'vote1INCH');
    });

    describe('setDelegate', async () => {
        it('should set delegate and emit Delegate event', async () => {
            const tx = await this.votingDelegation.setDelegate(addr1, delegatee);
            expect(await this.votingDelegation.delegated(addr1)).to.be.equals(delegatee);
            expect(tx.logs[0].event).to.be.equals('Delegate');
        });

        it('should set delegate and emit Undelegate event', async () => {
            const tx = await this.votingDelegation.setDelegate(addr1, constants.ZERO_ADDRESS);
            expect(await this.votingDelegation.delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
            expect(tx.logs[0].event).to.be.equals('Undelegate');
        });

        it('should delegate by only owner', async () => {
            await expect(this.votingDelegation.setDelegate(addr1, delegatee, { from: addr2 }))
                .to.eventually.be.rejectedWith('Ownable: caller is not the owner');
        });
    });

    describe('updateBalances', async () => {
        beforeEach(async () => {
            await this.votingDelegation.setDelegate(addr1, delegatee);
            await this.votingDelegation.setDelegate(addr2, newDelegatee);
            this.amount = ether('1');
        });

        it('address(0) -> addr1 should increase delegatee balance', async () => {
            const balanceBefore = await this.votingDelegation.balanceOf(delegatee);
            await this.votingDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount);
            expect(await this.votingDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBefore.add(this.amount));
        });

        it('addr1 -> address(0) should decrease delegatee balance', async () => {
            await this.votingDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount.muln(5));
            const balanceBefore = await this.votingDelegation.balanceOf(delegatee);
            await this.votingDelegation.updateBalances(addr1, constants.ZERO_ADDRESS, this.amount);
            expect(await this.votingDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBefore.sub(this.amount));
        });

        it('addr1 -> addr2 should change delegatee balances', async () => {
            await this.votingDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount.muln(10));
            await this.votingDelegation.updateBalances(constants.ZERO_ADDRESS, addr2, this.amount.muln(20));
            const balanceBeforeDelegatee = await this.votingDelegation.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await this.votingDelegation.balanceOf(newDelegatee);
            await this.votingDelegation.updateBalances(addr1, addr2, this.amount);
            expect(await this.votingDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBeforeDelegatee.sub(this.amount));
            expect(await this.votingDelegation.balanceOf(newDelegatee)).to.be.bignumber.eq(balanceBeforeNewDelegatee.add(this.amount));
        });
    });

    describe('ERC20 overrides', async () => {
        it('should not transfert', async () => {
            await expect(this.votingDelegation.transfer(addr2, ether('1')))
                .to.eventually.be.rejectedWith('MethodDisabled()');
        });

        it('should not transferFrom', async () => {
            await expect(this.votingDelegation.transferFrom(addr2, delegatee, ether('1')))
                .to.eventually.be.rejectedWith('MethodDisabled()');
        });

        it('should not approve', async () => {
            await expect(this.votingDelegation.approve(addr2, ether('1')))
                .to.eventually.be.rejectedWith('MethodDisabled()');
        });
    });
});
