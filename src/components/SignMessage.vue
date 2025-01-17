<script setup lang="ts">
import { AppMode } from '@arcana/auth'
import { useRoute } from 'vue-router'

import SignMessageAdvancedInfo from '@/components/signMessageAdvancedInfo.vue'
import SignMessageCompact from '@/components/SignMessageCompact.vue'
import type { Request } from '@/models/Connection'
import { useAppStore } from '@/store/app'
import { useRequestStore } from '@/store/request'
import { useRpcStore } from '@/store/rpc'
import { advancedInfo } from '@/utils/advancedInfo'
import { methodAndAction } from '@/utils/method'

const appStore = useAppStore()
const requestStore = useRequestStore()
const route = useRoute()

defineProps({
  request: {
    type: Request,
    required: true,
  },
})

const emits = defineEmits(['reject', 'approve'])

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
</script>

<template>
  <SignMessageCompact
    v-if="appStore.compactMode"
    :request="request"
    @approve="emits('approve')"
    @reject="emits('reject')"
  />
  <div v-else class="card flex flex-1 flex-col gap-4 p-4">
    <div class="flex flex-col">
      <h1 class="flex-1 m-0 font-bold text-lg text-center capitalize">
        {{ getTitle(methodAndAction[request.request.method]) }}
      </h1>
      <p class="text-xs text-gray-100 text-center">
        {{ appStore.name }} requests your permission for
        {{ methodAndAction[request.request.method] }}
      </p>
    </div>
    <div class="flex flex-col gap-1">
      <div class="text-sm">Message</div>
      <SignMessageAdvancedInfo
        :info="advancedInfo(request.request.method, request.request.params)"
      />
      <div class="flex justify-center mt-4">
        <div
          class="flex bg-gray-300 rounded-sm p-2 text-xs gap-1 text-gray-100"
        >
          <img src="@/assets/images/info-circle.svg" />
          <span>You're not going to be charged</span>
        </div>
      </div>
    </div>
    <div class="mt-auto flex flex-col gap-4">
      <div class="flex gap-2">
        <button
          class="btn-secondary p-2 uppercase w-full text-sm font-bold"
          @click="emits('reject')"
        >
          Reject
        </button>
        <button
          class="btn-primary p-2 uppercase w-full text-sm font-bold"
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
