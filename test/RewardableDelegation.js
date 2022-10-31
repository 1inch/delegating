const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe.skip('RewardableDelegationPod', function () {
    let addr1, addr2, delegatee, newDelegatee;
    let DelegatedShare;
    const MAX_FARM = 5;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
        DelegatedShare = await ethers.getContractFactory('DelegatedShare');
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
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));
                expect(await delegatedShare.name()).to.equal('TestTokenName');
                expect(await delegatedShare.symbol()).to.equal('TestTokenSymbol');
            });

            it('should mint and burn DelegatedShare only ReawardableDelegation', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));
                await expect(delegatedShare.mint(addr1.address, '1000'))
                    .to.be.revertedWith('Ownable: caller is not the owner');
                await expect(delegatedShare.burn(addr1.address, '1000'))
                    .to.be.revertedWith('Ownable: caller is not the owner');
            });

            it('should not double registrate', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await expect(delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName2', 'TestTokenSymbol2', MAX_FARM))
                    .to.be.revertedWithCustomError(delegationPod, 'AlreadyRegistered');
            });
        });

        describe('register(IDelegatedShare)', function () {
            it('should registrate delegatee', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                const delegatedShare = await DelegatedShare.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegatedShare.deployed();
                await delegationPod.connect(delegatee).functions['register(address)'](delegatedShare.address);
                expect(await delegationPod.registration(delegatee.address)).to.equal(delegatedShare.address);
            });

            it('should not registrate with already used token', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));
                await expect(delegationPod.connect(newDelegatee).functions['register(address)'](delegatedShare.address))
                    .to.be.revertedWithCustomError(delegationPod, 'AnotherDelegateeToken');
            });

            it('should not double registrate', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                const delegatedShare = await DelegatedShare.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegationPod.connect(delegatee).functions['register(address)'](delegatedShare.address);
                await expect(delegationPod.connect(delegatee).functions['register(address)'](delegatedShare.address))
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
            const delegatedShare = await DelegatedShare.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
            await delegatedShare.deployed();
            await delegationPod.connect(delegatee).functions['register(address)'](delegatedShare.address);
            await delegatedShare.connect(delegatee).transferOwnership(delegationPod.address);

            const newDelegateeToken = await DelegatedShare.connect(newDelegatee).deploy('TestTokenName_2', 'TestTokenName_2', MAX_FARM);
            await newDelegateeToken.deployed();
            await delegationPod.connect(newDelegatee).functions['register(address)'](newDelegateeToken.address);
            await newDelegateeToken.connect(newDelegatee).transferOwnership(delegationPod.address);

            await delegationPod.delegate(delegatee.address);
            await delegationPod.connect(addr2).delegate(newDelegatee.address);

            const amount = ether('1');
            return { delegationPod, delegatedShare, newDelegateeToken, amount };
        };

        it('`address(0) -> addr1` should mint DelegatedShare for addr1', async function () {
            const { delegationPod, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            const balanceBefore = await delegatedShare.balanceOf(addr1.address);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should burn DelegatedShare for addr1', async function () {
            const { delegationPod, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            await delegationPod.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 5n);
            const balanceBefore = await delegatedShare.balanceOf(addr1.address);
            await delegationPod.updateBalances(addr1.address, constants.ZERO_ADDRESS, amount);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change their DelegatedShare balances', async function () {
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
