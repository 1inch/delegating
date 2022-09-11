const { constants, expect, ether } = require('@1inch/solidity-utils');
const hre = require('hardhat');
const { artifacts } = hre;

const SolvingDelegation = artifacts.require('SolvingDelegation');
const SolvingDelegateeToken = artifacts.require('SolvingDelegateeToken');

describe('SolvingDelegation', async () => {
    let addr1, addr2, delegatee, newDelegatee;

    before(async () => {
        [addr1, addr2, delegatee, newDelegatee] = await web3.eth.getAccounts();
    });

    beforeEach(async () => {
        this.solvingDelegation = await SolvingDelegation.new('solving1INCH', 'solving1INCH');
    });

    describe('register', async () => {
        describe('register(string,string)', async () => {
            it('should registrate delegee and create new token', async () => {
                expect(await this.solvingDelegation.registration(delegatee)).to.be.equals(constants.ZERO_ADDRESS);
                await this.solvingDelegation.contract.methods.register('1INCHSolverTokenName', '1INCHSolverTokenSymbol').send({ from: delegatee });
                const delegateeToken = await hre.ethers.getContractAt('SolvingDelegateeToken', await this.solvingDelegation.registration(delegatee));
                expect(await delegateeToken.name()).to.be.equals('1INCHSolverTokenName');
                expect(await delegateeToken.symbol()).to.be.equals('1INCHSolverTokenSymbol');
            });

            it('should mint and burn SolvingDelegateeToken only SolvingDelegation', async () => {
                await this.solvingDelegation.contract.methods.register('1INCHSolverTokenName', '1INCHSolverTokenSymbol').send({ from: delegatee });
                const delegateeToken = await hre.ethers.getContractAt('SolvingDelegateeToken', await this.solvingDelegation.registration(delegatee));
                await expect(delegateeToken.mint(addr1, '1000'))
                    .to.eventually.be.rejectedWith('Ownable: caller is not the owner');
                await expect(delegateeToken.burn(addr1, '1000'))
                    .to.eventually.be.rejectedWith('Ownable: caller is not the owner');
            });
        });

        describe('register(IDelegateeToken)', async () => {
            it('should registrate delegee', async () => {
                const delegateeToken = await SolvingDelegateeToken.new('1INCHSolverTokenName', '1INCHSolverTokenSymbol', { from: delegatee });
                await this.solvingDelegation.contract.methods.register(delegateeToken.address).send({ from: delegatee });
                expect(await this.solvingDelegation.registration(delegatee)).to.be.equals(delegateeToken.address);
            });

            it('should not registrate with already used token', async () => {
                await this.solvingDelegation.contract.methods.register('1INCHSolverTokenName', '1INCHSolverTokenSymbol').send({ from: delegatee });
                const delegateeToken = await hre.ethers.getContractAt('SolvingDelegateeToken', await this.solvingDelegation.registration(delegatee));
                await expect(this.solvingDelegation.contract.methods.register(delegateeToken.address).send({ from: delegatee }))
                    .to.eventually.be.rejectedWith('AnotherDelegateeToken()');
            });
        });
    });

    describe('setDelegate', async () => {
        beforeEach(async () => {
            await this.solvingDelegation.contract.methods.register('1INCHSolverTokenName', '1INCHSolverTokenSymbol').send({ from: delegatee });
        });

        it('should set delegate and emit Delegate event', async () => {
            const tx = await this.solvingDelegation.setDelegate(addr1, delegatee);
            expect(await this.solvingDelegation.delegated(addr1)).to.be.equals(delegatee);
            expect(tx.logs[0].event).to.be.equals('Delegate');
        });

        it('should set delegate and emit Undelegate event', async () => {
            const tx = await this.solvingDelegation.setDelegate(addr1, constants.ZERO_ADDRESS);
            expect(await this.solvingDelegation.delegated(addr1)).to.be.equals(constants.ZERO_ADDRESS);
            expect(tx.logs[0].event).to.be.equals('Undelegate');
        });

        it('should delegate by only owner', async () => {
            await expect(this.solvingDelegation.setDelegate(addr1, delegatee, { from: addr2 }))
                .to.eventually.be.rejectedWith('Ownable: caller is not the owner');
        });

        it('should not delegate not registered delegatee', async () => {
            await expect(this.solvingDelegation.setDelegate(addr1, newDelegatee))
                .to.eventually.be.rejectedWith('NotRegisteredDelegatee()');
        });
    });

    describe('updateBalances', async () => {
        beforeEach(async () => {
            this.delegateeToken = await SolvingDelegateeToken.new('1INCHSolverTokenName', '1INCHSolverTokenSymbol', { from: delegatee });
            await this.solvingDelegation.contract.methods.register(this.delegateeToken.address).send({ from: delegatee });
            await this.delegateeToken.transferOwnership(this.solvingDelegation.address, { from: delegatee });

            this.newDelegateeToken = await SolvingDelegateeToken.new('1INCHSolverTokenName_2', '1INCHSolverTokenName_2', { from: newDelegatee });
            await this.solvingDelegation.contract.methods.register(this.newDelegateeToken.address).send({ from: newDelegatee });
            await this.newDelegateeToken.transferOwnership(this.solvingDelegation.address, { from: newDelegatee });

            await this.solvingDelegation.setDelegate(addr1, delegatee);
            await this.solvingDelegation.setDelegate(addr2, newDelegatee);

            this.amount = ether('1');
        });

        it('`address(0) -> addr1` should mint SolvingDelegateeToken for addr1', async () => {
            const balanceBefore = await this.delegateeToken.balanceOf(addr1);
            await this.solvingDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount);
            expect(await this.delegateeToken.balanceOf(addr1)).to.be.bignumber.eq(balanceBefore.add(this.amount));
        });

        it('`addr1 -> address(0)` should burn SolvingDelegateeToken for addr1', async () => {
            await this.solvingDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount.muln(5));
            const balanceBefore = await this.delegateeToken.balanceOf(addr1);
            await this.solvingDelegation.updateBalances(addr1, constants.ZERO_ADDRESS, this.amount);
            expect(await this.delegateeToken.balanceOf(addr1)).to.be.bignumber.eq(balanceBefore.sub(this.amount));
        });

        it('`addr1 -> addr2` should change their SolvingDelegateeToken balances', async () => {
            await this.solvingDelegation.updateBalances(constants.ZERO_ADDRESS, addr1, this.amount.muln(10));
            await this.solvingDelegation.updateBalances(constants.ZERO_ADDRESS, addr2, this.amount.muln(20));
            const balanceBeforeDelegatee = await this.solvingDelegation.balanceOf(delegatee);
            const balanceBeforeNewDelegatee = await this.solvingDelegation.balanceOf(newDelegatee);
            await this.solvingDelegation.updateBalances(addr1, addr2, this.amount);
            expect(await this.solvingDelegation.balanceOf(delegatee)).to.be.bignumber.eq(balanceBeforeDelegatee.sub(this.amount));
            expect(await this.solvingDelegation.balanceOf(newDelegatee)).to.be.bignumber.eq(balanceBeforeNewDelegatee.add(this.amount));
        });
    });
});
