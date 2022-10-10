type AssetContract = {
  address: string
  symbol: string
  decimals: number
  logo?: string
  name?: string
}

type EthAssetContract = AssetContract & {
  erc20: boolean
  erc721: boolean
}

type Asset = Omit<AssetContract, 'address'> & { balance: number }

export type { Asset, AssetContract, EthAssetContract }