require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');
require('@nomicfoundation/hardhat-chai-matchers');
require('solidity-coverage');
require('hardhat-dependency-compiler');
require('hardhat-deploy');
require('hardhat-tracer');
require('hardhat-gas-reporter');
require('dotenv').config();
const { Networks, getNetwork } = require('@1inch/solidity-utils/hardhat-setup');

const { networks, etherscan } = (new Networks()).registerAll();

module.exports = {
    etherscan,
    solidity: {
        version: '0.8.23',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000000,
            },
            evmVersion: networks[getNetwork()]?.hardfork || 'shanghai',
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
            '@1inch/token-hooks/contracts/mocks/ERC20HooksMock.sol',
            '@1inch/token-hooks/contracts/mocks/HookMock.sol',
            '@1inch/token-hooks/contracts/mocks/BadHookMock.sol',
            '@1inch/token-hooks/contracts/mocks/AccountingOnlyHookMock.sol',
            '@1inch/token-hooks/contracts/mocks/ReentrancyHookMock.sol',
        ],
    },
};
