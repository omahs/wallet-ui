import { defineStore } from 'pinia'

import { RpcConfigWallet, CHAIN_LIST } from '@/models/RpcConfigList'

type RpcConfigs = {
  [chainId: number]: RpcConfigWallet
}

type RpcConfigState = {
  selectedChainId: number
  walletBalance: string
  rpcConfigs: RpcConfigs | null
}

export const useRpcStore = defineStore('rpcStore', {
  state: () =>
    ({
      selectedChainId: 0,
      walletBalance: '',
      rpcConfigs: null,
    } as RpcConfigState),

  getters: {
    currency(): string {
      if (this.isArcanaNetwork) return 'XAR'
      if (this.selectedRpcConfig?.nativeCurrency)
        return this.selectedRpcConfig.nativeCurrency.symbol
      else return ''
    },
    isArcanaNetwork() {
      const chainName: string =
        this.selectedRpcConfig?.chainName?.toLowerCase() || ''
      return chainName.includes('arcana')
    },
    selectedRpcConfig(state: RpcConfigState): RpcConfigWallet {
      const { selectedChainId } = state
      if (this.rpcConfigs) {
        return this.rpcConfigs[selectedChainId]
      } else {
        const found = CHAIN_LIST.find(
          (chain) => chain.chainId == selectedChainId
        )
        if (found) {
          return found
        } else {
          // Default to Arcana dev
          return CHAIN_LIST[7]
        }
      }
    },
    rpcConfigList(state: RpcConfigState): Array<RpcConfigWallet> {
      return Object.values(state.rpcConfigs || {})
    },
  },

  actions: {
    addNetwork(rpcConfig: RpcConfigWallet) {
      if (this.rpcConfigs) this.rpcConfigs[rpcConfig.chainId] = rpcConfig
      else this.rpcConfigs = { [rpcConfig.chainId]: rpcConfig }
    },
    setSelectedChainId(chainId: number): void {
      this.selectedChainId = chainId
    },
    setWalletBalance(balance): void {
      this.walletBalance = balance
    },
    setRpcConfigs(list: Array<RpcConfigWallet>) {
      const configs = {}
      list.forEach((chainConfig) => {
        configs[chainConfig.chainId] = chainConfig
      })
      this.rpcConfigs = configs
    },
  },
})
