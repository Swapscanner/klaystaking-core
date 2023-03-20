import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomiclabs/hardhat-web3';
import 'solidity-coverage';

const config: HardhatUserConfig = {
  solidity: '0.8.18',
  networks: {
    hardhat: {
      gasPrice: 50000000000,
      blockGasLimit: 0x1ffffffffffff,
      allowUnlimitedContractSize: true,
    },
  },
};

export default config;
