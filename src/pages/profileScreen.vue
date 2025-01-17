<script setup lang="ts">
import type { Connection } from 'penpal'
import { storeToRefs } from 'pinia'
import { ref, toRefs, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'

import AppLoader from '@/components/AppLoader.vue'
import ExportKeyModal from '@/components/ExportKeyModal.vue'
import MFAProceedModal from '@/components/MFAProceedModal.vue'
import PrivateKeyCautionModal from '@/components/PrivateKeyCautionModal.vue'
import type { ParentConnectionApi } from '@/models/Connection'
import { useAppStore } from '@/store/app'
import { useModalStore } from '@/store/modal'
import { useParentConnectionStore } from '@/store/parentConnection'
import { useRpcStore } from '@/store/rpc'
import { useUserStore } from '@/store/user'
import { AUTH_URL } from '@/utils/constants'
import { downloadFile } from '@/utils/downloadFile'
import { getAuthProvider } from '@/utils/getAuthProvider'
import { getImage } from '@/utils/getImage'
import { isInAppLogin } from '@/utils/isInAppLogin'
import { getWindowFeatures } from '@/utils/popupProps'
import { getStorage } from '@/utils/storageWrapper'

const user = useUserStore()
const router = useRouter()
const appStore = useAppStore()
const toast = useToast()
const rpcStore = useRpcStore()
const modalStore = useModalStore()
const parentConnectionStore = useParentConnectionStore()
const { selectedRpcConfig } = storeToRefs(rpcStore)
const showPrivateKeyCautionModal = ref(false)
const showMFAProceedModal = ref(false)
const showExportKeyModal = ref(false)
const loader = ref({
  show: false,
  message: '',
})

const {
  info: { email, name },
} = user
const { walletAddressShrinked, walletAddress, privateKey } = toRefs(user)
const { id: appId } = appStore
const parentConnection: Connection<ParentConnectionApi> | null =
  parentConnectionStore.parentConnection

let mfaWindow: Window | null
let cleanExit = false

async function copyToClipboard(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(message)
  } catch (err) {
    toast.error('Failed to copy')
  }
}

async function handleLogout() {
  const parentConnectionInstance = await parentConnection?.promise
  const authProvider = await getAuthProvider(appId)
  await user.handleLogout(authProvider)
  appStore.showWallet = false
  parentConnectionInstance?.onEvent('disconnect')
}

function handleProceed() {
  showPrivateKeyCautionModal.value = false
  showExportKeyModal.value = true
}

function handleShowPrivateKeyCautionModal() {
  modalStore.setShowModal(true)
  showPrivateKeyCautionModal.value = true
}

function handleHidePrivateKeyCautionModal() {
  modalStore.setShowModal(false)
  showPrivateKeyCautionModal.value = false
}

function handleHideExportKeyModal() {
  modalStore.setShowModal(false)
  showExportKeyModal.value = false
}

function handlePrivateKeyDownload() {
  const fileData = new Blob([privateKey.value], {
    type: 'text/plain',
  })
  downloadFile(`${walletAddress.value}-private-key.txt`, fileData)
}

function handleShowMFAProceedModal(show: boolean) {
  modalStore.setShowModal(show)
  showMFAProceedModal.value = show
}

async function handleMFASetupClick() {
  const info = getStorage().session.getUserInfo()
  if (!info) {
    return
  }

  if (isInAppLogin(info.loginType)) {
    modalStore.setShowModal(false)
    router.push({ name: 'MFASetup', params: { appId: appStore.id } })
  } else {
    cleanExit = false
    const mfaSetupPath = new URL(`mfa/${appStore.id}/setup`, AUTH_URL)
    if (appStore.standaloneMode == 0) {
      mfaWindow = window.open(
        mfaSetupPath.toString(),
        '_blank',
        getWindowFeatures()
      )

      const handler = async (event: MessageEvent) => {
        if (!event?.data?.status) {
          return
        }
        cleanExit = true
        const data = event.data

        if (data.status === 'success') {
          mfaWindow?.close()
          getStorage().local.setHasMFA(user.info.id)
          user.hasMfa = true
          toast.success('MFA setup completed')
          window.removeEventListener('message', handler, false)
          handleShowMFAProceedModal(false)
          hideLoader()
        } else if (data.status == 'error') {
          mfaWindow?.close()
          window.removeEventListener('message', handler, false)
          hideLoader()
          if (data.error !== 'User cancelled the setup') toast.error(data.error)
        } else {
          toast.error('Error occured while setting up MFA. Please try again')
          console.log('Unexpected event')
        }
      }
      window.addEventListener('message', handler, false)

      loader.value = {
        show: true,
        message: 'Setting up MFA...',
      }

      const id = window.setInterval(() => {
        if (!cleanExit && mfaWindow?.closed) {
          console.error('User closed the popup')
          window.removeEventListener('message', handler, false)
          hideLoader()
          clearInterval(id)
        }
      }, 500)
    } else {
      const c = await useParentConnectionStore().parentConnection?.promise
      c?.uiEvent('mfa_setup', {})
    }
  }
}

function hideLoader() {
  loader.value = {
    show: false,
    message: '',
  }
}

onBeforeRouteLeave((to) => {
  if (to.path.includes('login')) parentConnection?.destroy()
})

watch(
  () => modalStore.show,
  () => {
    if (!modalStore.show) {
      showPrivateKeyCautionModal.value = false
      showExportKeyModal.value = false
      showMFAProceedModal.value = false
    }
  }
)
</script>

<template>
  <div v-if="loader.show" class="flex justify-center items-center flex-1">
    <AppLoader :message="loader.message" />
  </div>
  <div v-else class="flex-grow flex flex-col gap-5 mb-5">
    <div class="flex justify-center align-center">
      <span class="text-lg font-bold">Profile</span>
    </div>
    <div class="card p-4 flex flex-col gap-5">
      <div v-if="name" class="flex flex-col">
        <span class="text-sm text-gray-100">Name</span>
        <span class="text-lg font-bold">
          {{ name }}
        </span>
      </div>
      <div class="flex flex-col">
        <span class="text-sm text-gray-100">Email ID</span>
        <span class="text-lg font-bold">
          {{ email || 'Not available' }}
        </span>
      </div>
      <div class="flex flex-col">
        <span class="text-sm text-gray-100">Wallet Address</span>
        <div class="flex gap-2">
          <span class="text-lg font-bold">
            {{ walletAddressShrinked }}
          </span>
          <button
            title="Click to copy"
            @click.stop="
              copyToClipboard(walletAddress, 'Wallet address copied')
            "
          >
            <img
              :src="getImage('copy-big.svg')"
              alt="Click to copy"
              class="w-md h-md"
            />
          </button>
        </div>
      </div>
      <div class="flex flex-col">
        <span class="text-sm text-gray-100">Private Key</span>
        <button
          class="flex gap-2 items-center"
          title="Click to export private key"
          @click.stop="handleShowPrivateKeyCautionModal"
        >
          <span class="text-lg font-bold"> Export Key </span>
          <img :src="getImage('external-link.svg')" class="w-md h-md" />
        </button>
      </div>
      <div v-if="appStore.isMfaEnabled" class="flex flex-col">
        <span class="text-sm text-gray-100">Enhance Wallet Security</span>
        <div>
          <button
            v-if="!user.hasMfa"
            class="text-lg font-bold flex gap-2 items-center"
            title="Click to setup MFA"
            @click.stop="handleShowMFAProceedModal(true)"
          >
            <span v-if="true">Setup Now</span>
            <span v-else>Update Security Questions</span>
            <img :src="getImage('external-link.svg')" class="w-md h-md" />
          </button>
          <span v-else class="text-lg font-bold">In use</span>
        </div>
      </div>
      <div class="flex">
        <button
          class="flex flex-grow justify-center items-center btn-secondary p-2 font-bold text-sm uppercase"
          @click="handleLogout"
        >
          Logout
        </button>
      </div>
    </div>
    <Teleport v-if="modalStore.show" to="#modal-container">
      <PrivateKeyCautionModal
        v-if="showPrivateKeyCautionModal"
        @proceed="handleProceed"
        @close="handleHidePrivateKeyCautionModal"
      />
      <ExportKeyModal
        v-if="showExportKeyModal"
        :private-key="privateKey"
        @copy="copyToClipboard(privateKey, 'Private key copied')"
        @download="handlePrivateKeyDownload"
        @close="handleHideExportKeyModal"
      />
      <MFAProceedModal
        v-if="showMFAProceedModal"
        @proceed="handleMFASetupClick"
        @close="handleShowMFAProceedModal(false)"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.home__title {
  font-size: var(--fs-500);
}

.home__body-container {
  padding: var(--p-400);
  color: var(--fg-color);
  border-radius: 10px;
}

.home__body-content-label {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--fg-color-secondary);
}

.home__body-content-value {
  display: flex;
  align-items: center;
  font-size: var(--fs-400);
  font-weight: 400;
}

.home__footer-button-outline {
  color: var(--outlined-button-fg-color);
  border-color: var(--outlined-button-border-color);
}

.home__footer-button-filled {
  flex: 1;
  color: var(--filled-button-fg-color);
  background-color: var(--filled-button-bg-color);
  border-radius: 10px;
}
</style>
