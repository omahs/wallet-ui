// Todo: Find a better place for these functions
import { requirePermission } from '@/models/Connection'
import { router } from '@/routes'
import { store } from '@/store'
import { useActivitiesStore } from '@/store/activities'
import { useRpcStore } from '@/store/rpc'

const activitiesStore = useActivitiesStore(store)
const rpcStore = useRpcStore(store)

function getSendRequestFn(handleRequest, requestStore, appStore) {
  return function sendRequest(request) {
    return handleRequest(request, requestStore, appStore)
  }
}

function watchRequestQueue(reqStore, keeper) {
  reqStore.$subscribe(async (_, state) => {
    const { processQueue, pendingRequests } = state
    const pendingRequestCount = Object.values(pendingRequests).length
    const connectionInstance = await keeper.connection.promise
    try {
      connectionInstance.sendPendingRequestCount(pendingRequestCount)
    } catch (err) {
      console.error({ err })
    }
    while (processQueue.length > 0) {
      const request = processQueue.shift()
      processRequest(request, keeper)
    }
  })
}

function switchChain(request, keeper) {
  const { chainId } = request.params[0]
  const rpcConfigs = rpcStore.rpcConfigs
  if (rpcConfigs && rpcConfigs[chainId]) {
    rpcStore.setSelectedChainId(Number(chainId))
    keeper.reply(request.method, {
      result: `Chain changed to ${rpcConfigs[chainId].chainName}`,
      id: request.id,
    })
    router.push({ name: 'home' })
  } else {
    keeper.reply(request.method, {
      result: `Chain Id ${chainId} is not in the list`,
      id: request.id,
    })
  }
}

function isExistingRpcUrl(url) {
  const exisitingRpcUrls = rpcStore.rpcConfigList
    .map((chain) => chain.rpcUrls)
    .flat()

  return exisitingRpcUrls.some((rpcUrl) => {
    return rpcUrl === url
  })
}

function isExistingChainId(chainId) {
  return rpcStore.rpcConfigList.some((chain) => chain.chainId === chainId)
}

function addNetwork(request, keeper) {
  const { method, params } = request
  const { networkInfo } = params[0]
  const rpcUrl = networkInfo.rpcUrl
  const chainId = Number(networkInfo.chainId)

  let result = ''

  if (isExistingRpcUrl(rpcUrl)) {
    result = `RPC URL - ${rpcUrl} already exists, please use different one`
  } else if (isExistingChainId(Number(chainId))) {
    result = `Chain ID - ${chainId} already exists, please use different one`
  } else {
    const payload = {
      chainName: networkInfo.networkName,
      chainId: Number(networkInfo.chainId),
      blockExplorerUrls: [networkInfo.explorerUrl],
      rpcUrls: [networkInfo.rpcUrl],
      favicon: 'blockchain-icon',
      isCustom: true,
      nativeCurrency: {
        symbol: networkInfo.nativeCurrency.symbol,
        decimals: networkInfo.nativeCurrency.decimals || 18,
      },
    }
    rpcStore.addNetwork(payload)
    router.push({ name: 'home' })
    result = `Added the network ${networkInfo.networkName} and set it as current`
  }

  keeper.reply(method, {
    result,
    id: request.id,
  })
}

async function processRequest({ request, isPermissionGranted }, keeper) {
  if (isPermissionGranted) {
    if (
      request.method === 'wallet_switchEthereumChain' ||
      request.method === 'wallet_addEthereumChain'
    ) {
      const { method } = request
      if (method === 'wallet_switchEthereumChain') switchChain(request, keeper)
      if (method === 'wallet_addEthereumChain') addNetwork(request, keeper)
    } else {
      const response = await keeper.request(request)
      keeper.reply(request.method, response)
      if (request.method === 'eth_signTypedData_v4' && request.params[1]) {
        const params = JSON.parse(request.params[1])
        if (params.domain.name === 'Arcana Forwarder') {
          activitiesStore.saveFileActivity(
            rpcStore.selectedRpcConfig?.chainId as number,
            params.message.data
          )
        }
      }
      if (request.method === 'eth_sendTransaction' && response.result) {
        activitiesStore.fetchAndSaveActivityFromHash({
          txHash: response.result,
          chainId: rpcStore.selectedRpcConfig?.chainId as number,
        })
      }
    }
  } else {
    keeper.reply(request.method, {
      error: 'user_deny',
      result: null,
      id: request.id,
    })
  }
}

async function handleRequest(request, requestStore, appStore) {
  const isPermissionRequired = requirePermission(request, appStore.validAppMode)
  requestStore.addRequests(request, isPermissionRequired, new Date())
}

export { getSendRequestFn, watchRequestQueue, handleRequest }
