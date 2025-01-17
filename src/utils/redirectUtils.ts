import { GetInfoOutput, SocialLoginType } from '@arcana/auth-core'
import { AsyncMethodReturns } from 'penpal'

import { RedirectParentConnectionApi } from '@/models/Connection'
import { encrypt } from '@/utils/crypto'
import {
  getCredentialKey,
  getPasswordlessState,
  setCredential,
} from '@/utils/PasswordlessLoginHandler'

const SOCIAL_TIMEOUT = 5000 // 5s timeout
const PASSWORDLESS_TIMEOUT = 1500 // 1.5s timeout

const LOGIN_INFO = 'LOGIN_INFO'
const LOGIN_INFO_ACK = 'LOGIN_INFO_ACK'

const LOGIN_VERIFY = 'LOGIN_VERIFY'
const LOGIN_VERIFY_ACK = 'LOGIN_VERIFY_ACK'

const LOGIN_INIT = 'LOGIN_INIT'
const LOGIN_INIT_ACK = 'LOGIN_INIT_ACK'

const LOGIN_PWDL_INQ = 'LOGIN_PWDL_INQ'
const LOGIN_PWDL_INQ_RES = 'LOGIN_PWDL_INQ_RES'

const MFA_SETUP = 'MFA_SETUP'
const MFA_SETUP_ACK = 'MFA_SETUP_ACK'

const ACK = [LOGIN_INFO_ACK, MFA_SETUP_ACK]

interface InteractMessage {
  status: string
  params: { [k: string]: any }
  expectedResponseStatus: Array<string>
}

const interactWithIframe = <T>(
  input: InteractMessage,
  domain = process.env.VUE_APP_WALLET_DOMAIN
): Promise<T> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      return reject('request timed out')
    }, SOCIAL_TIMEOUT)
    try {
      const frameLength = window.parent.opener.frames.length
      const listener = (ev: MessageEvent<T & { status: string }>) => {
        if (ev.origin !== domain) {
          return
        }

        if (input.expectedResponseStatus.includes(ev.data.status)) {
          window.removeEventListener('message', listener)
          resolve(ev.data)
        }
      }
      window.addEventListener('message', listener)
      for (let i = 0; i < frameLength; i++) {
        try {
          window.parent.opener.frames[i].postMessage(
            {
              status: input.status,
              ...input.params,
            },
            domain
          )
        } catch (e) {
          // Intentionally ignoring errors
        }
      }
    } catch (e) {
      reject(new Error('Could not contact parent page, login did not succeed'))
    }
  })
}

const fetchPasswordlessResponseFromSignIn = async ({
  sessionId,
  setToken,
}: {
  sessionId: string
  setToken: string
}) => {
  const state = getPasswordlessState(sessionId, setToken)
  const data = await interactWithIframe<{
    status: string
    error: string | null
    success: boolean
  }>({
    status: LOGIN_PWDL_INQ,
    params: {
      state,
    },
    expectedResponseStatus: [LOGIN_PWDL_INQ_RES],
  })

  const { error = null, success = false } = data
  if (success) {
    return 'ok'
  } else {
    return Promise.reject(error)
  }
}

const catchupSigninPage = async (state: string) => {
  return interactWithIframe<void>({
    status: LOGIN_INIT,
    params: {
      state,
    },
    expectedResponseStatus: [LOGIN_INIT_ACK],
  })
}

const verifyOpenerPage = async (state: string) => {
  const data = await interactWithIframe<{ verified: boolean }>({
    status: LOGIN_VERIFY,
    params: {
      state,
    },
    expectedResponseStatus: [LOGIN_VERIFY_ACK],
  })
  if (data?.verified) {
    return 'ok'
  } else {
    return Promise.reject('not ok')
  }
}

const contactParentPage = async (params: HandleLoginParams, status: string) => {
  const data = await interactWithIframe<{ messageId: number }>({
    status,
    params: {
      sessionID: params.sessionID,
      sessionExpiry: params.sessionExpiry,
      messageId: params.messageId,
      info: params.userInfo,
    },
    expectedResponseStatus: ACK,
  })
  if (data.messageId === params.messageId) {
    return 'ok'
  }
}

async function handlePasswordlessLoginV2(params: HandleLoginParams) {
  const [sessionId, setToken] = params.state.split('-')
  const publicKey = await getCredentialKey(sessionId)
  const dataToEncrypt = {
    privateKey: params.userInfo.privateKey,
    pk: params.userInfo.pk,
    sessionID: params.sessionID,
    expiry: params.sessionExpiry,
  }
  let ciphertext = await encrypt(JSON.stringify(dataToEncrypt), publicKey)
  if (params.userInfo.hasMfa) {
    ciphertext = `${ciphertext}:has-mfa`
  }
  await setCredential(setToken, sessionId, ciphertext)
  await params.connection.replyTo()
}

async function handleSocialLogin(params: HandleLoginParams) {
  try {
    await contactParentPage(params, LOGIN_INFO)
    await params.connection.replyTo()
  } catch (e) {
    console.log('A very unexpected error occurred', e)
    await params.connection.error(
      'Could not login, an unexpected error occurred'
    )
  }
}

const getStateFromUrl = (u: string) => {
  const url = new URL(decodeURIComponent(u), process.env.VUE_APP_WALLET_DOMAIN)
  const queryParams = url.searchParams
  const hashParams = new URLSearchParams(url.hash.substring(1))
  const key = 'state'
  let val = hashParams.get(key) ?? ''
  if (!val) {
    val = queryParams.get(key) ?? ''
  }

  return val
}

type HandleLoginParams = {
  isStandalone: boolean
  userInfo: GetInfoOutput & {
    hasMfa?: boolean
    pk?: string
  }
  state: string
  sessionID: string
  sessionExpiry: number
  connection: AsyncMethodReturns<RedirectParentConnectionApi>
  messageId: number
}

const handleLogin = async (params: HandleLoginParams) => {
  if (params.userInfo.loginType === SocialLoginType.passwordless) {
    await handlePasswordlessLoginV2(params)
  } else {
    if (params.isStandalone) {
      await params.connection.goToWallet()
      return
    }
    await handleSocialLogin(params)
  }
}

export {
  interactWithIframe,
  catchupSigninPage,
  fetchPasswordlessResponseFromSignIn,
  handleLogin,
  contactParentPage,
  getStateFromUrl,
  verifyOpenerPage,
  MFA_SETUP,
  LOGIN_INFO,
  MFA_SETUP_ACK,
  LOGIN_INFO_ACK,
}
