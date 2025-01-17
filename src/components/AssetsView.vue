<script setup lang="ts">
import { ethers } from 'ethers'
import { onMounted, onBeforeUnmount, ref, watch, type Ref } from 'vue'

import type { Asset, AssetContract } from '@/models/Asset'
import AddTokenScreen from '@/pages/AddTokenScreen.vue'
import { useModalStore } from '@/store/modal'
import { useRpcStore } from '@/store/rpc'
import { useUserStore } from '@/store/user'
import { getTokenBalance } from '@/utils/contractUtil'
import { formatTokenDecimals, beautifyBalance } from '@/utils/formatTokens'
import { getImage } from '@/utils/getImage'
import { sleep } from '@/utils/sleep'
import { getStorage } from '@/utils/storageWrapper'
import { getIconAsset } from '@/utils/useImage'

const userStore = useUserStore()
const rpcStore = useRpcStore()
const assets: Ref<Asset[]> = ref([])
const modalStore = useModalStore()
const showModal = ref(false)
let assetsPolling

type AssetProps = {
  refresh: boolean
}

const props = defineProps<AssetProps>()

function fetchStoredAssetContracts(): AssetContract[] {
  const assetContracts = getStorage().local.getAssetContractList(
    userStore.walletAddress,
    Number(rpcStore.selectedRPCConfig?.chainId)
  )
  return assetContracts
}

function fetchNativeAsset() {
  return {
    address: 'native',
    name: rpcStore.nativeCurrency?.name,
    balance: !rpcStore.walletBalance
      ? 0
      : Number(ethers.utils.formatEther(rpcStore.walletBalance)),
    decimals: rpcStore.nativeCurrency?.decimals as number,
    symbol: rpcStore.nativeCurrency?.symbol as string,
    logo:
      rpcStore.selectedRpcConfig && rpcStore.selectedRpcConfig.favicon
        ? `${rpcStore.selectedRpcConfig.favicon}.png`
        : 'fallback-token.png',
  }
}

async function getAssetsBalance() {
  assets.value = [fetchNativeAsset()]
  const storedAssetContracts = fetchStoredAssetContracts()
  storedAssetContracts.forEach((contract) => {
    assets.value.push({
      address: contract.address,
      name: contract.name || contract.symbol,
      symbol: contract.symbol,
      balance: 0,
      logo: contract.logo || 'fallback-token.png',
      decimals: contract.decimals,
    })
  })
  storedAssetContracts.forEach(async (contract) => {
    try {
      const balance = await getTokenBalance({
        walletAddress: userStore.walletAddress,
        contractAddress: contract.address,
      })
      const asset = assets.value.find(
        (asset) => asset.address === contract.address
      )
      if (asset) {
        asset.balance = formatTokenDecimals(balance, contract.decimals)
      }
    } catch (err) {
      console.error({ err })
    }
  })
}

function updateAssetsBalance() {
  assets.value.forEach(async (asset) => {
    if (asset.address !== 'native') {
      const balance = await getTokenBalance({
        walletAddress: userStore.walletAddress,
        contractAddress: asset.address,
      })
      asset.balance = formatTokenDecimals(balance, asset.decimals)
    }
  })
}

function handleAddToken() {
  modalStore.setShowModal(true)
  showModal.value = true
}

function isNative(asset: Asset) {
  return asset.address === 'native'
}

onMounted(async () => {
  await getAssetsBalance()
})

onBeforeUnmount(() => {
  clearInterval(assetsPolling)
})

rpcStore.$subscribe(getAssetsBalance)

watch(
  () => modalStore.show,
  async () => {
    if (!modalStore.show) {
      showModal.value = false
      clearInterval(assetsPolling)
      await getAssetsBalance()
    }
  }
)

watch(
  () => props.refresh,
  async () => {
    await getAssetsBalance()
  }
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <span class="uppercase font-lg font-bold">Assets</span>
    <div class="card flex flex-col overflow-hidden">
      <div
        v-if="assets.length"
        class="flex flex-col gap-4 p-3 m-1 max-h-[120px] overflow-y-auto"
      >
        <div
          v-for="asset in assets"
          :key="`asset-${asset.symbol}`"
          class="flex justify-between items-center"
        >
          <div class="flex items-center gap-3">
            <img
              :src="getIconAsset(`token-logos/${asset.logo}`)"
              class="w-[1.25rem] aspect-square rounded-full select-none"
            />
            <span
              class="font-normal text-base overflow-hidden whitespace-nowrap text-ellipsis w-[12ch]"
              :title="asset.name"
              >{{ asset.name }}</span
            >
          </div>
          <div
            class="gap-1 font-normal text-base leading-none text-right overflow-hidden whitespace-nowrap text-ellipsis transition-all duration-200"
            :title="`${
              isNative(asset)
                ? ethers.utils.formatEther(rpcStore.walletBalance)
                : asset.balance.toFixed(asset.decimals)
            } ${asset.symbol}`"
          >
            {{ beautifyBalance(asset.balance) }}
            {{ asset.symbol }}
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col flex-grow py-5 gap-5">
        <span class="m-auto font-normal text-base">No tokens added</span>
      </div>
      <button
        class="flex py-1 gap-2 items-center justify-center flex-grow btn-quaternery border-r-0 border-l-0 border-b-0 border-t-1"
        @click.stop="handleAddToken"
      >
        <img :src="getImage('plus.svg')" class="h-lg w-lg" />
        <span class="text-sm font-normal">New</span>
      </button>
    </div>
    <Teleport v-if="modalStore.show" to="#modal-container">
      <AddTokenScreen v-if="showModal" />
    </Teleport>
  </div>
</template>
