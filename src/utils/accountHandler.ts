import { cipher, decryptWithPrivateKey } from 'eth-crypto'
import {
  concatSig,
  personalSign,
  signTypedData_v4 as signTypedDataV4,
} from 'eth-sig-util'
import { stripHexPrefix, ecsign, setLengthLeft } from 'ethereumjs-util'
import { ethers } from 'ethers'

interface TransactionData extends ethers.providers.TransactionRequest {
  from: string
}
const allowedKeys = [
  'to',
  'from',
  'nonce',
  'gasLimit',
  'gasPrice',
  'data',
  'value',
  'chainId',
  'type',
  'accessList',
  'maxPriorityFeePerGas',
  'maxFeePerGas',
  'customData',
  'ccipReadEnabled',
]

function filterTransactionData(txObj: TransactionData): TransactionData {
  const filtered = Object.keys(txObj)
    .filter((key) => allowedKeys.includes(key))
    .reduce((obj, key) => {
      obj[key] = txObj[key]
      return obj
    }, {})
  return filtered as TransactionData
}

export class AccountHandler {
  wallet: ethers.Wallet
  provider: ethers.providers.JsonRpcProvider

  constructor(privateKey: string, rpcUrl: string) {
    this.wallet = new ethers.Wallet(privateKey)
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  }

  getAccount(): { address: string; publicKey: string } {
    const { address, publicKey } = this.wallet
    return { address, publicKey }
  }

  getAccounts(): string[] {
    return [this.wallet.address]
  }

  getWallet(address: string): ethers.Wallet | undefined {
    if (this.wallet.address.toUpperCase() === address.toUpperCase()) {
      return this.wallet
    }
    return undefined
  }

  getConnectedWallet(address: string): ethers.Wallet | undefined {
    const wallet = this.getWallet(address)
    if (wallet) {
      return wallet.connect(this.provider)
    }
    return undefined
  }

  async getChainId() {
    if (this.provider.network) return this.provider.network.chainId
    return (await this.provider.detectNetwork()).chainId
  }

  getPublicKey(address: string): string {
    const wallet = this.getWallet(address)
    if (wallet) {
      return this.wallet.publicKey
    } else {
      throw new Error('No Wallet found for the provided address')
    }
  }

  async requestSign(address: string, msg: string): Promise<string> {
    try {
      const wallet = this.getWallet(address)
      if (wallet) {
        const signature = ecsign(
          setLengthLeft(Buffer.from(stripHexPrefix(msg), 'hex'), 32),
          Buffer.from(stripHexPrefix(wallet.privateKey), 'hex')
        )
        const rawMessageSig = concatSig(
          signature.v as unknown as Buffer,
          signature.r,
          signature.s
        )
        return rawMessageSig
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async requestPersonalSign(address: string, msg: string) {
    try {
      const wallet = this.getWallet(address)
      if (wallet) {
        const signature = personalSign(
          Buffer.from(stripHexPrefix(wallet.privateKey), 'hex'),
          { data: msg }
        )
        return signature
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async requestDecryption(ciphertext: string, address: string) {
    try {
      const wallet = this.getWallet(address)
      if (wallet) {
        const parsedCipher = cipher.parse(ciphertext)
        const decryptedMessage = await decryptWithPrivateKey(
          wallet.privateKey,
          parsedCipher
        )
        return decryptedMessage
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async requestSendTransaction(txData: TransactionData) {
    try {
      const wallet = this.getConnectedWallet(txData.from)
      if (wallet) {
        const data = filterTransactionData(txData)
        if (!data.gasPrice) {
          data.gasPrice = await wallet.getGasPrice()
        }
        const tx = await wallet.sendTransaction({ ...data })
        return tx.hash
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      console.log(e)
      return Promise.reject(e)
    }
  }

  async requestSignTransaction(txData: TransactionData) {
    try {
      const wallet = this.getConnectedWallet(txData.from)
      if (wallet) {
        const data = filterTransactionData(txData)
        const sig = await wallet.signTransaction({ ...data })
        return sig
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async requestSignTypedMessage(data: string, address: string) {
    const wallet = this.getWallet(address)
    if (wallet) {
      const parsedData = JSON.parse(data)
      const signature = signTypedDataV4(
        Buffer.from(stripHexPrefix(wallet.privateKey), 'hex'),
        { data: parsedData }
      )
      return signature
    } else {
      throw new Error('No Wallet found for the provided address')
    }
  }
}
