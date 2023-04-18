import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import 'solidity-coverage';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 2 ** 32 - 1,
      },
      viaIR: process.env.DISABLE_IR ? false : true,
    },
  },
  networks: {
    hardhat: {
      gasPrice: 50000000000,
      blockGasLimit: 0x1ffffffffffff,
      allowUnlimitedContractSize: true,
    },
  },
};

export default config;
