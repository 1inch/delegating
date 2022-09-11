const { constants, expect, ether } = require('@1inch/solidity-utils');
const { artifacts } = require('hardhat');

const BasicDelegation = artifacts.require('BasicDelegation');

describe('BasicDelegation', async () => {
    let addr1, addr2, delegatee, newDelegatee;

    before(async () => {
        [addr1, addr2, delegatee, newDelegatee] = await web3.eth.getAccounts();
    });

    beforeEach(async () => {
        this.basicDelegation = await BasicDelegation.new('basic1INCH', 'basic1INCH');
    });

    describe('setDelegate', async () => {
        it('should set delegate and emit Delegate event', async () => {
            const tx = await this.basicDelegation.setDelegate(addr1, delegatee);
            expect(await this.basicDelegation.delegated(addr1)).to.be.equals(delegatee);
            expect(tx.logs[0].event).to.be.equals('Delegate');
        });

        it('should set delegate and emit Undelegate event', async () => {
            const tx = await this.basicDelegation.setDelegate(addr1, constants.ZERO_ADDRESS);
            expect(await this.basicDelegation.delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
            expect(tx.logs[0].event).to.be.equals('Undelegate');
        });

        it('should delegate by only owner', async () => {
            await expect(this.basicDelegation.setDelegate(addr1, delegatee, { from: addr2 }))
                .to.eventually.be.rejectedWith('Ownable: caller is not the owner');
        });
    });

    describe('updateBalances', async () => {
        beforeEach(async () => {
            await this.basicDelegation.setDelegate(addr1, delegatee);
            await this.basicDelegation.setDelegate(addr2, newDelegatee);
            this.amount = ether('1');
        });

        it('`address(0) -> addr1` should increase delegatee balance', async () => {
            const balanceBefore = await this.basicDelegation.balanceOf(delegatee);
            await this.basicDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount);
            expect(await this.basicDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBefore.add(this.amount));
        });

        it('`addr1 -> address(0)` should decrease delegatee balance', async () => {
            await this.basicDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount.muln(5));
            const balanceBefore = await this.basicDelegation.balanceOf(delegatee);
            await this.basicDelegation.updateBalances(addr1, constants.ZERO_ADDRESS, this.amount);
            expect(await this.basicDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBefore.sub(this.amount));
        });

        it('`addr1 -> addr2` should change delegatee balances', async () => {
            await this.basicDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount.muln(10));
            await this.basicDelegation.updateBalances(constants.ZERO_ADDRESS, addr2, this.amount.muln(20));
            const balanceBeforeDelegatee = await this.basicDelegation.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await this.basicDelegation.balanceOf(newDelegatee);
            await this.basicDelegation.updateBalances(addr1, addr2, this.amount);
            expect(await this.basicDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBeforeDelegatee.sub(this.amount));
            expect(await this.basicDelegation.balanceOf(newDelegatee)).to.be.bignumber.eq(balanceBeforeNewDelegatee.add(this.amount));
        });
    });

    describe('ERC20 overrides', async () => {
        it('should not transfert', async () => {
            await expect(this.basicDelegation.transfer(addr2, ether('1')))
                .to.eventually.be.rejectedWith('MethodDisabled()');
        });

        it('should not transferFrom', async () => {
            await expect(this.basicDelegation.transferFrom(addr2, delegatee, ether('1')))
                .to.eventually.be.rejectedWith('MethodDisabled()');
        });

        it('should not approve', async () => {
            await expect(this.basicDelegation.approve(addr2, ether('1')))
                .to.eventually.be.rejectedWith('MethodDisabled()');
        });
    });
});
