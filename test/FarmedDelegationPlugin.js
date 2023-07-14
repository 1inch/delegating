const { constants, expect, ether } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { shouldBehaveLikeERC20Plugins } = require('@1inch/token-plugins/test/behaviors/ERC20Plugins.behavior.js');

describe('FarmingDelegationPlugin', function () {
    let addr1, addr2, delegatee, newDelegatee;
    const MAX_SHARE_PLUGINS = 3;
    const SHARE_PLUGINS_GASLIMIT = 150000;
    const ERC20_PLUGINS_GASLIMIT = 500000;

    before(async function () {
        [addr1, addr2, delegatee, newDelegatee] = await ethers.getSigners();
    });

    describe('shouldBehaveLikeERC20Plugins', function () {
        async function initContractsBehavior () {
            const Erc20PluginsMock = await ethers.getContractFactory('ERC20PluginsMock');
            const delegatedToken = await Erc20PluginsMock.deploy('ERC20PluginsMock', 'EPM', 5, ERC20_PLUGINS_GASLIMIT);
            await delegatedToken.deployed();
            const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
            const delegationPlugin = await FarmingDelegationPlugin.deploy('FarmingDelegationPlugin', 'FDP', delegatedToken.address, MAX_SHARE_PLUGINS, SHARE_PLUGINS_GASLIMIT);
            await delegationPlugin.deployed();
            await delegatedToken.addPlugin(delegationPlugin.address);
            await delegationPlugin.functions['register(string,string)']('TestTokenName', 'TestTokenSymbol');
            await delegationPlugin.delegate(addr1.address);

            const amount = ether('1');
            await delegatedToken.mint(addr1.address, amount);

            const erc20Plugins = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(addr1.address));
            await erc20Plugins.removePlugin(await delegationPlugin.defaultFarms(addr1.address));
            const PLUGIN_COUNT_LIMITS = MAX_SHARE_PLUGINS;
            return { erc20Plugins, PLUGIN_COUNT_LIMITS, amount };
        };

        shouldBehaveLikeERC20Plugins(initContractsBehavior);
    });

    async function initContracts () {
        const Erc20PluginsMock = await ethers.getContractFactory('ERC20PluginsMock');
        const erc20Plugins = await Erc20PluginsMock.deploy('ERC20PluginsMock', 'EPM', 5, ERC20_PLUGINS_GASLIMIT);
        await erc20Plugins.deployed();
        const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
        const delegationPlugin = await FarmingDelegationPlugin.deploy('FarmingDelegationPlugin', 'FDP', erc20Plugins.address, MAX_SHARE_PLUGINS, SHARE_PLUGINS_GASLIMIT);
        await delegationPlugin.deployed();
        const amount = ether('1');
        return { erc20Plugins, delegationPlugin, amount };
    };

    async function initContractsAndRegister () {
        const { erc20Plugins, delegationPlugin } = await initContracts();
        await delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName', 'TestTokenSymbol');
        return { erc20Plugins, delegationPlugin };
    };

    describe('register', function () {
        describe('register(string,string,uint256)', function () {
            it('should registrate delegatee and create new token', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                expect(await delegationPlugin.registration(delegatee.address)).to.equal(constants.ZERO_ADDRESS);
                await delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName', 'TestTokenSymbol');
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee.address));
                expect(await delegatedShare.name()).to.equal('TestTokenName');
                expect(await delegatedShare.symbol()).to.equal('TestTokenSymbol');
            });

            it('should emit Register event', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                await expect(
                    delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName', 'TestTokenSymbol'),
                ).to.emit(
                    delegationPlugin,
                    'RegisterDelegatee',
                ).withArgs(
                    delegatee.address,
                );
            });

            it('should mint and burn DelegatedShare only ReawardableDelegation', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                await delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName', 'TestTokenSymbol');
                const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee.address));
                await expect(delegatedShare.mint(addr1.address, '1000'))
                    .to.be.revertedWithCustomError(delegatedShare, 'NotOwnerPlugin');
                await expect(delegatedShare.burn(addr1.address, '1000'))
                    .to.be.revertedWithCustomError(delegatedShare, 'NotOwnerPlugin');
            });

            it('should not double registrate', async function () {
                const { delegationPlugin } = await loadFixture(initContracts);
                await delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName', 'TestTokenSymbol');
                await expect(delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName2', 'TestTokenSymbol2'))
                    .to.be.revertedWithCustomError(delegationPlugin, 'AlreadyRegistered');
            });
        });
    });

    describe('setDefaultFarm', function () {
        it('should set default farm', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee.address));
            const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
            const farmPlugin = await FarmingDelegationPlugin.deploy('FarmPlugin', 'FRM', delegatedShare.address, MAX_SHARE_PLUGINS, SHARE_PLUGINS_GASLIMIT);
            await farmPlugin.deployed();
            await delegationPlugin.connect(delegatee).setDefaultFarm(farmPlugin.address);

            expect(await delegationPlugin.defaultFarms(delegatee.address)).to.equal(farmPlugin.address);
        });

        it('should not set default farm non-registered user', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            expect(await delegationPlugin.defaultFarms(newDelegatee.address)).to.equal(constants.ZERO_ADDRESS);
            await expect(delegationPlugin.connect(newDelegatee).setDefaultFarm(constants.EEE_ADDRESS))
                .to.be.revertedWithCustomError(delegationPlugin, 'NotRegisteredDelegatee');
        });

        it('should add default farm for user when delegate', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);

            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee.address));

            const FarmingDelegationPlugin = await ethers.getContractFactory('FarmingDelegationPlugin');
            const farmPlugin = await FarmingDelegationPlugin.deploy('FarmPlugin', 'FRM', delegatedShare.address, MAX_SHARE_PLUGINS, SHARE_PLUGINS_GASLIMIT);
            await farmPlugin.deployed();
            await delegationPlugin.connect(delegatee).setDefaultFarm(farmPlugin.address);

            expect(await delegatedShare.hasPlugin(addr1.address, farmPlugin.address)).to.equal(false);
            await delegationPlugin.delegate(delegatee.address);
            expect(await delegatedShare.hasPlugin(addr1.address, farmPlugin.address)).to.equal(true);
        });
    });

    describe('delegate', function () {
        it('should set delegate and emit Delegated event', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            const tx = await delegationPlugin.delegate(delegatee.address);
            const receipt = await tx.wait();
            expect(await delegationPlugin.delegated(addr1.address)).to.equal(delegatee.address);
            expect(receipt.events[0].event).to.equal('Delegated');
        });

        it('should not delegate not registered delegatee', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            await expect(delegationPlugin.delegate(newDelegatee.address))
                .to.be.revertedWithCustomError(delegationPlugin, 'NotRegisteredDelegatee');
        });

        it('should undelegate', async function () {
            const { delegationPlugin } = await loadFixture(initContractsAndRegister);
            await delegationPlugin.delegate(delegatee.address);
            expect(await delegationPlugin.delegated(addr1.address)).to.equal(delegatee.address);
            await delegationPlugin.delegate(constants.ZERO_ADDRESS);
            expect(await delegationPlugin.delegated(addr1.address)).to.equal(constants.ZERO_ADDRESS);
        });
    });

    describe('updateBalances', function () {
        async function initContractsAndTokens () {
            const { erc20Plugins, delegationPlugin, amount } = await initContracts();
            await erc20Plugins.mint(addr1.address, amount);
            await erc20Plugins.mint(addr2.address, amount * 2n);

            await delegationPlugin.connect(delegatee).functions['register(string,string)']('TestTokenName1', 'TestTokenSymbol1');
            const delegatedShare = await ethers.getContractAt('DelegatedShare', await delegationPlugin.registration(delegatee.address));

            await delegationPlugin.connect(newDelegatee).functions['register(string,string)']('TestTokenName2', 'TestTokenSymbol2');

            await delegationPlugin.delegate(delegatee.address);

            return { erc20Plugins, delegationPlugin, delegatedShare, amount };
        };

        it('`address(0) -> addr1` should mint DelegatedShare for addr1', async function () {
            const { erc20Plugins, delegationPlugin, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(0);
            await erc20Plugins.addPlugin(delegationPlugin.address);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(amount);
        });

        it('`addr1 -> address(0)` should burn DelegatedShare for addr1', async function () {
            const { erc20Plugins, delegationPlugin, delegatedShare, amount } = await loadFixture(initContractsAndTokens);
            await erc20Plugins.addPlugin(delegationPlugin.address);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(amount);
            await erc20Plugins.removePlugin(delegationPlugin.address);
            expect(await delegatedShare.balanceOf(addr1.address)).to.equal(0);
        });

        it('`addr1 -> addr2` should change their DelegatedShare balances', async function () {
            const { erc20Plugins, delegationPlugin, amount } = await loadFixture(initContractsAndTokens);
            await erc20Plugins.connect(addr1).addPlugin(delegationPlugin.address);
            await erc20Plugins.connect(addr2).addPlugin(delegationPlugin.address);
            await delegationPlugin.connect(addr1).delegate(delegatee.address);
            await delegationPlugin.connect(addr2).delegate(newDelegatee.address);
            const transferAmount = amount / 2n;
            const balanceBeforeDelegatee = await delegationPlugin.balanceOf(delegatee.address);
            const balanceBeforeNewDelegatee = await delegationPlugin.balanceOf(newDelegatee.address);
            await erc20Plugins.transfer(addr2.address, transferAmount);
            expect(await delegationPlugin.balanceOf(delegatee.address)).to.equal(balanceBeforeDelegatee.sub(transferAmount));
            expect(await delegationPlugin.balanceOf(newDelegatee.address)).to.equal(balanceBeforeNewDelegatee.add(transferAmount));
        });
    });
});
