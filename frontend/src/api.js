const TOKEN_KEY = 'florafind_token'
const USER_KEY = 'florafind_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const resp = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (resp.status === 204) return null

  let data = null
  try {
    data = await resp.json()
  } catch {
    /* non-JSON error body */
  }

  if (!resp.ok) {
    const detail = data?.detail
    const message = typeof detail === 'string' ? detail : `Request failed (${resp.status})`
    const error = new Error(message)
    error.status = resp.status
    throw error
  }
  return data
}

export const api = {
  register: (email, username, password) =>
    request('/api/auth/register', { method: 'POST', body: { email, username, password } }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me', { auth: true }),

  listTrees: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') qs.set(key, value)
    }
    const suffix = qs.toString() ? `?${qs}` : ''
    return request(`/api/trees${suffix}`)
  },
  fruitTypes: () => request('/api/trees/fruit-types'),
  createTree: (tree) => request('/api/trees', { method: 'POST', body: tree, auth: true }),
  updateTree: (id, tree) => request(`/api/trees/${id}`, { method: 'PUT', body: tree, auth: true }),
  deleteTree: (id) => request(`/api/trees/${id}`, { method: 'DELETE', auth: true }),
}
