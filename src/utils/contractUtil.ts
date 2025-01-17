import { ethers } from 'ethers'

import ABI from '@/abis/erc20.abi.json'
import { getRequestHandler } from '@/utils/requestHandlerSingleton'

type ContractParams = {
  walletAddress: string
  contractAddress: string
}

type SymbolDecimalResponse = {
  symbol: string
  decimals: number
}

async function getTokenBalance(data: ContractParams): Promise<string> {
  const accountHandler = getRequestHandler().getAccountHandler()
  const ethersContract = new ethers.Contract(
    data.contractAddress,
    ABI,
    accountHandler.provider
  )

  const balance = await ethersContract.balanceOf(data.walletAddress)

  return balance.toString()
}

async function getTokenSymbolAndDecimals(
  data: Omit<ContractParams, 'walletAddress'>
): Promise<SymbolDecimalResponse> {
  const accountHandler = getRequestHandler().getAccountHandler()
  const ethersContract = new ethers.Contract(
    data.contractAddress,
    ABI,
    accountHandler.provider
  )

  const symbolPromise: Promise<string> = ethersContract.symbol()
  const decimalsPromise: Promise<number> = ethersContract.decimals()

  const [symbol, decimals] = await Promise.all([symbolPromise, decimalsPromise])

  return {
    symbol,
    decimals,
  }
}

export { getTokenBalance, getTokenSymbolAndDecimals }
