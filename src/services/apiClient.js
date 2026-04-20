const ACCESS_TOKEN_KEY = 'garten-api-access-token'
const REFRESH_TOKEN_KEY = 'garten-api-refresh-token'

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || ''
let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || ''

function persistTokens(tokens) {
  accessToken = tokens?.accessToken || ''
  refreshToken = tokens?.refreshToken || ''

  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

async function parseResponse(response) {
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const error = new Error(data?.message || `API request failed with ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

async function rawRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  return parseResponse(response)
}

async function refreshSession() {
  if (!refreshToken) return false

  try {
    const data = await rawRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    })
    persistTokens(data)
    return true
  } catch {
    persistTokens(null)
    return false
  }
}

export async function apiRequest(path, options = {}) {
  try {
    return await rawRequest(path, options)
  } catch (error) {
    if (error.status !== 401 || options.skipRefresh) {
      throw error
    }

    const refreshed = await refreshSession()
    if (!refreshed) throw error

    return rawRequest(path, { ...options, skipRefresh: true })
  }
}

export function hasSession() {
  return Boolean(accessToken && refreshToken)
}

export function clearSession() {
  persistTokens(null)
}

export async function register(email, password) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password },
  })
  persistTokens(data)
  return data.user
}

export async function login(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  persistTokens(data)
  return data.user
}

export async function logout() {
  try {
    if (refreshToken) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: { refreshToken },
      })
    }
  } finally {
    clearSession()
  }
}

export async function getMe() {
  return apiRequest('/me')
}

export async function fetchPlan(year) {
  return apiRequest(`/plans/${year}`)
}

export async function syncPlan(year, payload) {
  return apiRequest(`/plans/${year}/sync`, {
    method: 'POST',
    body: payload,
  })
}
