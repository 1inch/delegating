const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe('RewardableDelegationTopic', function () {
    let addr1, addr2, delegatee, newDelegatee;
    let RewardableDelegationTopic;
    let DelegateeToken;
    const MAX_FARM = 5;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
        RewardableDelegationTopic = await ethers.getContractFactory('RewardableDelegationTopic');
        DelegateeToken = await ethers.getContractFactory('DelegateeToken');
    });

    async function initContracts () {
        const delegationTopic = await RewardableDelegationTopic.deploy('Rewardable', 'RWD');
        await delegationTopic.deployed();
        return { delegationTopic };
    };

    describe('register', function () {
        describe('register(string,string)', function () {
            it('should registrate delegatee and create new token', async function () {
                const { delegationTopic } = await loadFixture(initContracts);
                expect(await delegationTopic.registration(delegatee.address)).to.equal(constants.ZERO_ADDRESS);
                await delegationTopic.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegateeToken = await ethers.getContractAt('DelegateeToken', await delegationTopic.registration(delegatee.address));
                expect(await delegateeToken.name()).to.equal('TestTokenName');
                expect(await delegateeToken.symbol()).to.equal('TestTokenSymbol');
            });

            it('should mint and burn DelegateeToken only ReawardableDelegation', async function () {
                const { delegationTopic } = await loadFixture(initContracts);
                await delegationTopic.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegateeToken = await ethers.getContractAt('DelegateeToken', await delegationTopic.registration(delegatee.address));
                await expect(delegateeToken.mint(addr1.address, '1000'))
                    .to.be.revertedWith('Ownable: caller is not the owner');
                await expect(delegateeToken.burn(addr1.address, '1000'))
                    .to.be.revertedWith('Ownable: caller is not the owner');
            });

            it('should not double registrate', async function () {
                const { delegationTopic } = await loadFixture(initContracts);
                await delegationTopic.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await expect(delegationTopic.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName2', 'TestTokenSymbol2', MAX_FARM))
                    .to.be.revertedWithCustomError(delegationTopic, 'AlreadyRegistered');
            });
        });

        describe('register(IDelegateeToken)', function () {
            it('should registrate delegatee', async function () {
                const { delegationTopic } = await loadFixture(initContracts);
                const delegateeToken = await DelegateeToken.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegateeToken.deployed();
                await delegationTopic.connect(delegatee).functions['register(address)'](delegateeToken.address);
                expect(await delegationTopic.registration(delegatee.address)).to.equal(delegateeToken.address);
            });

            it('should not registrate with already used token', async function () {
                const { delegationTopic } = await loadFixture(initContracts);
                await delegationTopic.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegateeToken = await ethers.getContractAt('DelegateeToken', await delegationTopic.registration(delegatee.address));
                await expect(delegationTopic.connect(newDelegatee).functions['register(address)'](delegateeToken.address))
                    .to.be.revertedWithCustomError(delegationTopic, 'AnotherDelegateeToken');
            });

            it('should not double registrate', async function () {
                const { delegationTopic } = await loadFixture(initContracts);
                const delegateeToken = await DelegateeToken.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegationTopic.connect(delegatee).functions['register(address)'](delegateeToken.address);
                await expect(delegationTopic.connect(delegatee).functions['register(address)'](delegateeToken.address))
                    .to.be.revertedWithCustomError(delegationTopic, 'AlreadyRegistered');
            });
        });
    });

    describe('setDelegate', function () {
        async function initContractsAndRegister () {
            const { delegationTopic } = await initContracts();
            await delegationTopic.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
            return { delegationTopic };
        };

        it('should set delegate and emit Delegate event', async function () {
            const { delegationTopic } = await loadFixture(initContractsAndRegister);
            const tx = await delegationTopic.setDelegate(addr1.address, delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationTopic.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegate');
        });

        it('should set delegate and emit Undelegate event', async function () {
            const { delegationTopic } = await loadFixture(initContractsAndRegister);
            const tx = await delegationTopic.setDelegate(addr1.address, constants.ZERO_ADDRESS);
            const receipt = await tx.wait();
            expect(await delegationTopic.delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
            expect(receipt.events[0].event).to.equal('Undelegate');
        });

        it('should delegate by only owner', async function () {
            const { delegationTopic } = await loadFixture(initContractsAndRegister);
            await expect(delegationTopic.connect(addr2).setDelegate(addr1.address, delegatee.address))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('should not delegate not registered delegatee', async function () {
            const { delegationTopic } = await loadFixture(initContractsAndRegister);
            await expect(delegationTopic.setDelegate(addr1.address, newDelegatee.address))
                .to.be.revertedWithCustomError(delegationTopic, 'NotRegisteredDelegatee');
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndTokens () {
            const { delegationTopic } = await initContracts();
            const delegateeToken = await DelegateeToken.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
            await delegateeToken.deployed();
            await delegationTopic.connect(delegatee).functions['register(address)'](delegateeToken.address);
            await delegateeToken.connect(delegatee).transferOwnership(delegationTopic.address);

            const newDelegateeToken = await DelegateeToken.connect(newDelegatee).deploy('TestTokenName_2', 'TestTokenName_2', MAX_FARM);
            await newDelegateeToken.deployed();
            await delegationTopic.connect(newDelegatee).functions['register(address)'](newDelegateeToken.address);
            await newDelegateeToken.connect(newDelegatee).transferOwnership(delegationTopic.address);

            await delegationTopic.setDelegate(addr1.address, delegatee.address);
            await delegationTopic.setDelegate(addr2.address, newDelegatee.address);

            const amount = ether('1');
            return { delegationTopic, delegateeToken, newDelegateeToken, amount };
        };

        it('`address(0) -> addr1` should mint DelegateeToken for addr1', async function () {
            const { delegationTopic, delegateeToken, amount } = await loadFixture(initContractsAndTokens);
            const balanceBefore = await delegateeToken.balanceOf(addr1.address);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount);
            expect(await delegateeToken.balanceOf(addr1.address)).to.equal(balanceBefore.add(amount));
        });

        it('`addr1 -> address(0)` should burn DelegateeToken for addr1', async function () {
            const { delegationTopic, delegateeToken, amount } = await loadFixture(initContractsAndTokens);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 5n);
            const balanceBefore = await delegateeToken.balanceOf(addr1.address);
            await delegationTopic.updateBalances(addr1.address, constants.ZERO_ADDRESS, amount);
            expect(await delegateeToken.balanceOf(addr1.address)).to.equal(balanceBefore.sub(amount));
        });

        it('`addr1 -> addr2` should change their DelegateeToken balances', async function () {
            const { delegationTopic, amount } = await loadFixture(initContractsAndTokens);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr1.address, amount * 10n);
            await delegationTopic.updateBalances(constants.ZERO_ADDRESS, addr2.address, amount * 20n);
            const balanceBeforeDelegatee = await delegationTopic.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationTopic.balanceOf(newDelegatee.address);
            await delegationTopic.updateBalances(addr1.address, addr2.address, amount);
            expect(await delegationTopic.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(amount));
            expect(await delegationTopic.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(amount));
        });
    });
});
