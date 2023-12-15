require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');
require('@nomicfoundation/hardhat-chai-matchers');
require('solidity-coverage');
require('hardhat-dependency-compiler');
require('hardhat-deploy');
require('hardhat-gas-reporter');
require('dotenv').config();

const { networks, etherscan } = require('./hardhat.networks');

module.exports = {
    etherscan,
    solidity: {
        version: '0.8.23',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000000,
            },
            viaIR: true,
        },
    },
    networks,
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    dependencyCompiler: {
        paths: [
            '@1inch/token-plugins/contracts/mocks/ERC20PluginsMock.sol',
            '@1inch/token-plugins/contracts/mocks/PluginMock.sol',
            '@1inch/token-plugins/contracts/mocks/BadPluginMock.sol',
        ],
    },
};
