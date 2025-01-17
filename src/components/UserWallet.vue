<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'

import AddNetwork from '@/components/AddNetwork.vue'
import BuyTokens from '@/components/BuyTokens.vue'
import EditNetwork from '@/components/EditNetwork.vue'
import {
  getExchangeRate,
  CurrencySymbol,
} from '@/services/exchangeRate.service'
import { useModalStore } from '@/store/modal'
import { useRpcStore } from '@/store/rpc'
import { useUserStore } from '@/store/user'
import { HIDE_ON_RAMP } from '@/utils/constants'
import { getImage } from '@/utils/getImage'
import { isSupportedByOnRampMoney } from '@/utils/onrampmoney.ramp'
import { getRequestHandler } from '@/utils/requestHandlerSingleton'
import { getTransakSupportedNetworks } from '@/utils/transak'

type UserWalletProps = {
  walletBalance?: string
  page: 'home' | 'nft'
  refreshIconAnimating: boolean
}

const props = defineProps<UserWalletProps>()
const emit = defineEmits(['show-loader', 'hide-loader', 'refresh'])
const router = useRouter()
const toast = useToast()

const EXCHANGE_RATE_CURRENCY: CurrencySymbol = 'USD'
type ModalState =
  | 'send'
  | 'receive'
  | 'add-network'
  | 'edit-network'
  | 'buy'
  | false

const userStore = useUserStore()
const modalStore = useModalStore()
const rpcStore = useRpcStore()
const showModal: Ref<ModalState> = ref(false)
const { currency } = storeToRefs(rpcStore)
const totalAmountInUSD: Ref<string | null> = ref(null)
const chainSelectedForEdit: Ref<number | null> = ref(null)

// TODO: move these to something else scoped to onramps

const transakNetwork = computed(() => {
  const selectedChainId = Number(rpcStore.selectedChainId)
  return getTransakSupportedNetworks().find(
    (network) => network.chainId === selectedChainId
  )
})

const onRampMoney = computed(() => {
  const selectedChainId = Number(rpcStore.selectedChainId)
  if (isSupportedByOnRampMoney(selectedChainId)) {
    return selectedChainId
  } else {
    return false
  }
})

function showLoader(message: string) {
  emit('show-loader', { message })
}

function hideLoader() {
  emit('hide-loader')
}

function handleRefresh() {
  emit('refresh')
}

function openAddNetwork(open) {
  modalStore.setShowModal(open)
  showModal.value = open ? 'add-network' : false
}

function openEditNetwork(open, chainId: number | null = null) {
  if (rpcStore.selectedRpcConfig) {
    if (Number(rpcStore.selectedRpcConfig.chainId) === Number(chainId)) {
      toast.error(
        'This network is current selected, please chose a different one and try again'
      )
    } else {
      chainSelectedForEdit.value = chainId
      modalStore.setShowModal(open)
      showModal.value = open ? 'edit-network' : false
    }
  }
}

function goToSendTokens() {
  if (props.page === 'nft') {
    router.push({ name: 'SelectNft' })
  } else {
    router.push({ name: 'SendTokens' })
  }
}

async function getCurrencyExchangeRate() {
  showLoader('Fetching Currency Rate')
  totalAmountInUSD.value = totalAmountInUSD.value || null
  try {
    if (currency.value) {
      const rate = await getExchangeRate(
        currency.value as CurrencySymbol,
        EXCHANGE_RATE_CURRENCY
      )
      if (rate) {
        totalAmountInUSD.value = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(Math.round(Number(props.walletBalance) * rate))
      }
    }
  } catch (err) {
    totalAmountInUSD.value = null
  } finally {
    hideLoader()
  }
}

function handleBuy(open: boolean) {
  modalStore.setShowModal(open)
  showModal.value = open ? 'buy' : false
}

function hasWalletBalanceAfterDecimals() {
  if (props.walletBalance?.includes('.')) {
    const balance = props.walletBalance.split('.')
    if (Number(balance[1]) > 0) {
      return true
    }
  }
  return false
}

onMounted(() => {
  if (props.walletBalance) {
    getCurrencyExchangeRate()
  }
})

watch(
  () => rpcStore.selectedRPCConfig?.chainId,
  async () => {
    if (rpcStore.selectedRPCConfig) {
      await getRequestHandler().setRpcConfig({
        ...rpcStore.selectedRPCConfig,
        chainId: Number(rpcStore.selectedRPCConfig.chainId),
      })
      if (props.walletBalance) {
        getCurrencyExchangeRate()
      }
    }
  }
)

watch(
  () => props.walletBalance,
  () => {
    getCurrencyExchangeRate()
  }
)

watch(
  () => modalStore.show,
  (show) => {
    if (!show) showModal.value = false
  }
)

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Wallet address copied')
  } catch (err) {
    toast.error('Failed to copy wallet address')
  }
}
</script>

<template>
  <div>
    <div class="card p-4 flex flex-col">
      <div class="flex justify-between items-center">
        <div class="flex gap-1">
          <img
            src="@/assets/images/fallback-logo-dark-mode.png"
            class="w-xl h-xl rounded-full"
          />
          <span class="font-bold text-lg">{{
            userStore.walletAddressShrinked
          }}</span>
          <button
            title="Click to copy wallet address"
            @click.stop="copyToClipboard(userStore.walletAddress)"
          >
            <img :src="getImage('copy.svg')" class="w-xl h-xl" />
          </button>
        </div>
      </div>
      <div class="mt-4 flex flex-col">
        <span class="font-normal text-sm text-gray-100">Total Balance:</span>
        <div class="flex items-center gap-4">
          <div
            class="transition-all duration-200"
            :class="{ 'blur-sm': props.refreshIconAnimating }"
          >
            <span class="font-bold text-xxl">{{
              props.walletBalance?.split('.')[0]
            }}</span>
            <span
              v-if="hasWalletBalanceAfterDecimals()"
              class="font-bold text-xxl"
              >.</span
            >
            <span
              v-if="hasWalletBalanceAfterDecimals()"
              class="font-bold text-base"
              >{{ props.walletBalance?.split('.')[1] }}</span
            >
            <span v-if="currency" class="font-bold text-base ml-1">
              {{ currency }}</span
            >
          </div>

          <button
            class="w-lg h-lg rounded-full"
            :class="{ 'animate-spin': refreshIconAnimating }"
            title="Click to refresh the balance"
            @click.stop="handleRefresh()"
          >
            <img :src="getImage('refresh.svg')" />
          </button>
        </div>
      </div>
      <div class="mt-6 flex gap-3">
        <button
          class="btn-secondary flex gap-1 justify-center p-2 items-center font-bold text-sm uppercase w-full"
          @click.stop="goToSendTokens()"
        >
          <img :src="getImage('send-icon.svg')" class="w-md h-md" />
          Send
        </button>
        <button
          class="btn-secondary flex gap-1 justify-center p-2 items-center font-bold text-sm uppercase w-full"
          :disabled="!transakNetwork && onRampMoney === false"
          @click.stop="handleBuy(true)"
        >
          <img :src="getImage('buy-icon.svg')" class="w-md h-md" />
          Buy
        </button>
      </div>
    </div>
    <Teleport v-if="modalStore.show" to="#modal-container">
      <AddNetwork
        v-if="showModal === 'add-network'"
        @close="openAddNetwork(false)"
      />
      <EditNetwork
        v-if="showModal === 'edit-network'"
        :chain-id="(chainSelectedForEdit as number)"
        @close="openEditNetwork(false)"
      />
      <BuyTokens
        v-if="showModal === 'buy'"
        :transak-network="transakNetwork?.value"
        :on-ramp-money="onRampMoney"
        @close="handleBuy(false)"
      />
    </Teleport>
  </div>
</template>
