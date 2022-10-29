const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe.skip('RewardableDelegationPod', function () {
    let addr1, addr2, delegatee, newDelegatee;
    let DelegateeToken;
    const MAX_FARM = 5;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
        DelegateeToken = await ethers.getContractFactory('DelegateeToken');
    });

    async function initContracts () {
        const RewardableDelegationPod = await ethers.getContractFactory('RewardableDelegationPod');
        const delegationPod = await RewardableDelegationPod.deploy('Rewardable', 'RWD', addr1.address);
        await delegationPod.deployed();
        return { delegationPod };
    };

    describe('register', function () {
        describe('register(string,string)', function () {
            it('should registrate delegatee and create new token', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                expect(await delegationPod.registration(delegatee.address)).to.equal(constants.ZERO_ADDRESS);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegateeToken = await ethers.getContractAt('DelegateeToken', await delegationPod.registration(delegatee.address));
                expect(await delegateeToken.name()).to.equal('TestTokenName');
                expect(await delegateeToken.symbol()).to.equal('TestTokenSymbol');
            });

            it('should mint and burn DelegateeToken only ReawardableDelegation', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegateeToken = await ethers.getContractAt('DelegateeToken', await delegationPod.registration(delegatee.address));
                await expect(delegateeToken.mint(addr1.address, '1000'))
                    .to.be.revertedWith('Ownable: caller is not the owner');
                await expect(delegateeToken.burn(addr1.address, '1000'))
                    .to.be.revertedWith('Ownable: caller is not the owner');
            });

            it('should not double registrate', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await expect(delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName2', 'TestTokenSymbol2', MAX_FARM))
                    .to.be.revertedWithCustomError(delegationPod, 'AlreadyRegistered');
            });
        });

        describe('register(IDelegateeToken)', function () {
            it('should registrate delegatee', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                const delegateeToken = await DelegateeToken.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegateeToken.deployed();
                await delegationPod.connect(delegatee).functions['register(address)'](delegateeToken.address);
                expect(await delegationPod.registration(delegatee.address)).to.equal(delegateeToken.address);
            });

            it('should not registrate with already used token', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegateeToken = await ethers.getContractAt('DelegateeToken', await delegationPod.registration(delegatee.address));
                await expect(delegationPod.connect(newDelegatee).functions['register(address)'](delegateeToken.address))
                    .to.be.revertedWithCustomError(delegationPod, 'AnotherDelegateeToken');
            });

            it('should not double registrate', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                const delegateeToken = await DelegateeToken.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegationPod.connect(delegatee).functions['register(address)'](delegateeToken.address);
                await expect(delegationPod.connect(delegatee).functions['register(address)'](delegateeToken.address))
                    .to.be.revertedWithCustomError(delegationPod, 'AlreadyRegistered');
            });
        });
    });

    describe('delegate', function () {
        async function initContractsAndRegister () {
            const { delegationPod } = await initContracts();
            await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
            return { delegationPod };
        };

        it('should set delegate and emit Delegate event', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            const tx = await delegationPod.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegate');
        });

        it('should set delegate and emit Undelegate event', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            const tx = await delegationPod.delegate(constants.ZERO_ADDRESS);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
            expect(receipt.events[0].event).to.equal('Undelegate');
        });

        it('should delegate by only owner', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            await expect(delegationPod.connect(addr2).delegate(delegatee.address))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should not delegate not registered delegatee', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            await expect(delegationPod.delegate(newDelegatee.address))
                .to.be.revertedWithCustomError(delegationPod, 'NotRegisteredDelegatee');
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndTokens () {
            const { delegationPod } = await initContracts();
            const delegateeToken = await DelegateeToken.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
            await delegateeToken.deployed();
            await delegationPod.connect(delegatee).functions['register(address)'](delegateeToken.address);
            await delegateeToken.connect(delegatee).transferOwnership(delegationPod.address);

            const newDelegateeToken = await DelegateeToken.connect(newDelegatee).deploy('TestTokenName_2', 'TestTokenName_2', MAX_FARM);
            await newDelegateeToken.deployed();
            await delegationPod.connect(newDelegatee).functions['register(address)'](newDelegateeToken.address);
            await newDelegateeToken.connect(newDelegatee).transferOwnership(delegationPod.address);

            await delegationPod.delegate(delegatee.address);
            await delegationPod.connect(addr2).delegate(newDelegatee.address);

            const amount = ether('1');
            return { delegationPod, delegateeToken, newDelegateeToken, amount };
        };

        it('`address(0) -> addr1` should mint DelegateeToken for addr1', async function () {
            const { delegationPod, delegateeToken, amount } = await loadFixture(initContractsAndTokens);
            const balanceBefore = await delegateeToken.balanceOf(addr1.address);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount);
            expect(await delegateeToken.balanceOf(addr1.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should burn DelegateeToken for addr1', async function () {
            const { delegationPod, delegateeToken, amount } = await loadFixture(initContractsAndTokens);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 5n);
            const balanceBefore = await delegateeToken.balanceOf(addr1.address);
            await delegationPod.updateBalances(addr1.address, constants.ZERO_ADDRESS, amount);
            expect(await delegateeToken.balanceOf(addr1.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change their DelegateeToken balances', async function () {
            const { delegationPod, amount } = await loadFixture(initContractsAndTokens);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 10n);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr2.address, amount * 20n);
            const balanceBeforeDelegatee = await delegationPod.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPod.balanceOf(newDelegatee.address);
            await delegationPod.updateBalances(addr1.address, addr2.address, amount);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(amount));
            expect(await delegationPod.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(amount));
        });
    });
});
