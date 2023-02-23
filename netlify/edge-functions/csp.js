/* eslint-disable import/no-anonymous-default-export */

const PATTERN = new URLPattern({
  pathname: '/:appId/*',
})

const getAppId = (path) => {
  const r = PATTERN.exec(path)
  return r.pathname.groups.appId
}

const fetchDomain = async (appId) => {
  const gwURL = Deno.env.get('VUE_APP_WALLET_GATEWAY', envV)
  const url = new URL(
    '/api/v1/get-app-config/',
    gwURL
  )
  url.searchParams.set('id', appId)
  const res = await fetch(url.href)
  console.log('Res:', res)
  if (res.status < 400) {
    const data = await res.json()
    return data.wallet_domain
  } else {
    throw new Error('Invalid AppId')
  }
}

export default async (req, context) => {
  const res = await context.next()
  try {
    const appId = getAppId(req.url)
    const domain = await fetchDomain(appId)
    console.log('Domain:', domain)
    if (domain) {
      res.header.set('Content-Security-Policy', `frame-ancestors ${domain}`)
    }
    return res
  } catch (e) {
    const response = JSON.stringify({ message: 'Not allowed' })
    return new Response(response, { status: 403 })
  }
}
