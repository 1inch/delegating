const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe('RewardableDelegationPod', function () {
    let addr1, addr2, delegatee, newDelegatee;
    let DelegatedShare;
    const MAX_FARM = 5;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
        DelegatedShare = await ethers.getContractFactory('DelegatedShare');
    });

    async function initContracts () {
        const Erc20PodsMock = await ethers.getContractFactory('ERC20PodsMock');
        const erc20Pods = await Erc20PodsMock.deploy('ERC20PodsMock', 'EPM', 10);
        await erc20Pods.deployed();
        const RewardableDelegationPod = await ethers.getContractFactory('RewardableDelegationPod');
        const delegationPod = await RewardableDelegationPod.deploy('Rewardable', 'RWD', erc20Pods.address);
        await delegationPod.deployed();
        const amount = ether('1');
        return { erc20Pods, delegationPod, amount };
    };

    async function initContractsAndRegister () {
        const { erc20Pods, delegationPod } = await initContracts();
        await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
        return { erc20Pods, delegationPod };
    };

    describe('register', function () {
        describe('register(string,string,uint256)', function () {
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
                await delegationPod.connect(delegatee).functions['register(address,address)'](delegatedShare.address, constants.ZERO_ADDRESS);
                expect(await delegationPod.registration(delegatee.address)).to.equal(delegatedShare.address);
            });

            it('should not registrate with already used token', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));
                await expect(delegationPod.connect(newDelegatee).functions['register(address,address)'](delegatedShare.address, constants.ZERO_ADDRESS))
                    .to.be.revertedWithCustomError(delegationPod, 'AnotherDelegateeToken');
            });

            it('should not double registrate', async function () {
                const { delegationPod } = await loadFixture(initContracts);
                const delegatedShare = await DelegatedShare.connect(delegatee).deploy('TestTokenName', 'TestTokenSymbol', MAX_FARM);
                await delegationPod.connect(delegatee).functions['register(address,address)'](delegatedShare.address, constants.ZERO_ADDRESS);
                await expect(delegationPod.connect(delegatee).functions['register(address,address)'](delegatedShare.address, constants.ZERO_ADDRESS))
                    .to.be.revertedWithCustomError(delegationPod, 'AlreadyRegistered');
            });
        });
    });

    describe('setDefaultFarm', function () {
        it('should set default farm', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            expect(await delegationPod.defaultFarms(delegatee.address)).to.equal(constants.ZERO_ADDRESS);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));
            const RewardableDelegationPod = await ethers.getContractFactory('RewardableDelegationPod');
            const farmPod = await RewardableDelegationPod.deploy('FarmPod', 'FRM', delegatedShare.address);
            await farmPod.deployed();
            await delegationPod.connect(delegatee).setDefaultFarm(farmPod.address);

            expect(await delegationPod.defaultFarms(delegatee.address)).to.equal(farmPod.address);
        });

        it('should not set default farm non-registered user', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            expect(await delegationPod.defaultFarms(newDelegatee.address)).to.equal(constants.ZERO_ADDRESS);
            await expect(delegationPod.connect(newDelegatee).setDefaultFarm(constants.EEE_ADDRESS))
                .to.be.revertedWithCustomError(delegationPod, 'NotRegisteredDelegatee');
        });
    });

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            const tx = await delegationPod.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPod.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegated');
        });

        it('should not delegate not registered delegatee', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            await expect(delegationPod.delegate(newDelegatee.address))
                .to.be.revertedWithCustomError(delegationPod, 'NotRegisteredDelegatee');
        });

        it('should undelegate', async function () {
            const { delegationPod } = await loadFixture(initContractsAndRegister);
            await delegationPod.delegate(delegatee.address);
            expect(await delegationPod.delegated(addr1.address)).to.equal(delegatee.address);
            await delegationPod.delegate(constants.ZERO_ADDRESS);
            expect(await delegationPod.delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
        });

        it('should add default farm for user when delegate', async function () {
            const { delegationPod } = await loadFixture(initContracts);

            await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName', 'TestTokenSymbol', MAX_FARM);
            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));

            const RewardableDelegationPod = await ethers.getContractFactory('RewardableDelegationPod');
            const farmPod = await RewardableDelegationPod.deploy('FarmPod', 'FRM', delegatedShare.address);
            await farmPod.deployed();
            await delegationPod.connect(delegatee).setDefaultFarm(farmPod.address);

            expect(await delegatedShare.hasPod(addr1.address, farmPod.address)).to.equal(false);
            await delegationPod.delegate(delegatee.address);
            expect(await delegatedShare.hasPod(addr1.address, farmPod.address)).to.equal(true);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndTokens () {
            const { erc20Pods, delegationPod, amount } = await initContracts();
            await erc20Pods.mint(addr1.address, amount);
            await erc20Pods.mint(addr2.address, amount * 2n);

            await delegationPod.connect(delegatee).functions['register(string,string,uint256)']('TestTokenName1', 'TestTokenSymbol1', MAX_FARM);
            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPod.registration(delegatee.address));

            await delegationPod.connect(newDelegatee).functions['register(string,string,uint256)']('TestTokenName2', 'TestTokenSymbol2', MAX_FARM);

            await delegationPod.delegate(delegatee.address);

            return { erc20Pods, delegationPod, delegatedShare, amount };
        };

        it('`address(0) -> addr1` should mint DelegatedShare for addr1', async function () {
            const { erc20Pods, delegationPod, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(0);
            await erc20Pods.addPod(delegationPod.address);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(amount);
        });

        it('`addr1 -> address(0)` should burn DelegatedShare for addr1', async function () {
            const { erc20Pods, delegationPod, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            await erc20Pods.addPod(delegationPod.address);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(amount);
            await erc20Pods.removePod(delegationPod.address);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(0);
        });

        it('`addr1 -> addr2` should change their DelegatedShare balances', async function () {
            const { erc20Pods, delegationPod, amount } = await loadFixture(initContractsAndTokens);
            await erc20Pods.connect(addr1).addPod(delegationPod.address);
            await erc20Pods.connect(addr2).addPod(delegationPod.address);
            await delegationPod.connect(addr1).delegate(delegatee.address);
            await delegationPod.connect(addr2).delegate(newDelegatee.address);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPod.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPod.balanceOf(newDelegatee.address);
            await erc20Pods.transfer(addr2.address, transferAmount);
            expect(await delegationPod.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(transferAmount));
            expect(await delegationPod.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(transferAmount));
        });
    });
});
