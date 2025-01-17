<script setup lang="ts">
import { AppMode } from '@arcana/auth'
import { useRoute } from 'vue-router'

import type { Request } from '@/models/Connection'
import { useAppStore } from '@/store/app'
import { useRequestStore } from '@/store/request'
import { methodAndAction } from '@/utils/method'

defineProps({
  request: {
    type: Request,
    required: true,
  },
})

const emits = defineEmits(['reject', 'approve'])

const appStore = useAppStore()
const route = useRoute()
const requestStore = useRequestStore()

const stateChangeRequests = [
  methodAndAction.wallet_addEthereumChain,
  methodAndAction.wallet_switchEthereumChain,
  methodAndAction.wallet_watchAsset,
]

function getTitle(requestMethod: string) {
  if (stateChangeRequests.includes(requestMethod)) {
    return requestMethod
  }
  return 'Sign Message'
}

function getPermissionText(method, request) {
  const { params } = request
  if (params instanceof Array && params[0]) {
    const { chainName } = params[0]
    if (method === 'wallet_addEthereumChain') {
      return chainName ? `Adding Chain - ${chainName}` : 'Adding Chain'
    } else if (method === 'wallet_switchEthereumChain') {
      return chainName ? `Switch Chain - ${chainName}` : 'Switch Chain'
    }
  }
  return methodAndAction[method]
}
</script>

<template>
  <div class="card p-4 flex flex-col gap-8">
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-center">
        <h1 class="m-0 font-bold text-lg capitalize">
          {{ getTitle(methodAndAction[request.request.method]) }}
        </h1>
      </div>
      <p class="text-sm text-center">
        {{ appStore.name }} requests your permission for
        {{ getPermissionText(request.request.method, request.request) }}
      </p>
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex justify-end gap-4 text-sm font-bold">
        <button
          class="uppercase btn-secondary w-full p-2"
          @click="emits('reject')"
        >
          Reject
        </button>
        <button
          class="uppercase btn-primary w-full p-2"
          @click="emits('approve')"
        >
          Approve
        </button>
      </div>
      <div
        v-if="
          route.name === 'requests' && appStore.validAppMode === AppMode.Full
        "
        class="flex items-center justify-center"
      >
        <button
          class="btn-tertiary text-sm font-bold"
          @click.stop="requestStore.skipRequest(request.request.id)"
        >
          Do this later
        </button>
      </div>
    </div>
  </div>
</template>
