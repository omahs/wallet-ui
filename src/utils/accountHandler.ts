import { Transaction } from '@ethereumjs/tx'
import { cipher, decryptWithPrivateKey } from 'eth-crypto'
import {
  concatSig,
  personalSign,
  signTypedData_v4 as signTypedDataV4,
} from 'eth-sig-util'
import {
  stripHexPrefix,
  ecsign,
  BN,
  bufferToHex,
  setLengthLeft,
} from 'ethereumjs-util'
import { ethers } from 'ethers'
import { JsonRpcRequest } from 'json-rpc-engine'

import {
  MessageParams,
  TransactionParams,
  TypedMessageParams,
  createWalletMiddleware,
} from '@/utils/walletMiddleware'

export class AccountHandler {
  wallet: ethers.Wallet
  provider: ethers.providers.JsonRpcProvider

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey)
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.VUE_APP_WALLET_RPC_URL
    )
  }

  setProvider(url: string) {
    this.provider = new ethers.providers.JsonRpcProvider(url)
  }

  asMiddleware() {
    return createWalletMiddleware({
      processEthSignMessage: this.ethSign,
      getAccounts: this.getAccounts,
      requestAccounts: this.getAccounts,
      processEncryptionPublicKey: this.getEncryptionPublicKey,
      processSignTransaction: this.signTransaction,
      processTypedMessageV4: this.signTypedMessageV4,
      processTransaction: this.sendTransaction,
    })
  }

  sendTransaction = async (
    p: TransactionParams,
    req: JsonRpcRequest<unknown>
  ): Promise<string> => {
    return (await this.requestSendTransaction(req.params, p.from)) as string
  }

  getAccounts = async (): Promise<string[]> => {
    return this.getAddress()
  }

  ethSign = async (p: MessageParams): Promise<string> => {
    return await this.requestSign(p.from, p.data)
  }

  getEncryptionPublicKey = async (from: string): Promise<string> => {
    return this.getPublicKey(from)
  }

  signTransaction = async (p: TransactionParams): Promise<string> => {
    const r = await this.requestSignTransaction(p, p.from)
    return r.raw
  }

  personalSign = async (p: MessageParams): Promise<string> => {
    return await this.requestPersonalSign(p.from, p.data)
  }

  ethDecrypt = async (p: MessageParams): Promise<string> => {
    return this.requestDecryption(p.data, p.from)
  }

  signTypedMessageV4 = async (p: TypedMessageParams): Promise<string> => {
    return this.requestSignTypedMessage(p.data, p.from)
  }

  getAccount(): { address: string; publicKey: string } {
    const { address, publicKey } = this.wallet
    return { address, publicKey }
  }

  getAddress(): string[] {
    return [this.wallet.address]
  }

  getWallet(address: string): ethers.Wallet | undefined {
    if (this.wallet.address.toUpperCase() === address.toUpperCase()) {
      return this.wallet
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

  async requestSendTransaction(data, address: string) {
    try {
      const wallet = this.getWallet(address)
      if (wallet) {
        const signer = wallet.connect(this.provider)
        const tx = await signer.sendTransaction(data)
        return tx.hash
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      return e
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

  async requestSignTransaction(txData, address: string) {
    try {
      const wallet = this.getWallet(address)
      if (wallet) {
        const transaction = Transaction.fromTxData({
          ...txData,
          value: new BN(txData.value, 10),
          gasPrice: new BN(txData.gasPrice, 10),
          gas: new BN(txData.gas, 10),
        })
        const tx = transaction.sign(
          Buffer.from(stripHexPrefix(wallet.privateKey), 'hex')
        )
        const raw = bufferToHex(tx.serialize())
        return { raw, tx: tx.toJSON() }
      } else {
        throw new Error('No Wallet found for the provided address')
      }
    } catch (e) {
      return Promise.reject(e)
    }
  }

  async requestSignTypedMessage(data, address: string) {
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
