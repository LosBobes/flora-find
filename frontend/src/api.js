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
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const resp = await fetch(path, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
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
  fruitTypes: (category) =>
    request(`/api/trees/fruit-types${category ? `?category=${encodeURIComponent(category)}` : ''}`),

  // Managed plant-type vocabulary. Listing is public; any signed-in user can add.
  listPlantTypes: (category) =>
    request(`/api/plant-types${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createPlantType: (payload) =>
    request('/api/plant-types', { method: 'POST', body: payload, auth: true }),

  // A user's public contribution profile: counts + a catalog of type badges.
  userProfile: (userId) => request(`/api/users/${userId}/profile`),

  createTree: (tree) => request('/api/trees', { method: 'POST', body: tree, auth: true }),
  updateTree: (id, tree) => request(`/api/trees/${id}`, { method: 'PUT', body: tree, auth: true }),
  deleteTree: (id) => request(`/api/trees/${id}`, { method: 'DELETE', auth: true }),

  // Drawn plant areas (polygons). Listing is public; create/update/delete need auth.
  listAreas: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') qs.set(key, value)
    }
    const suffix = qs.toString() ? `?${qs}` : ''
    return request(`/api/areas${suffix}`)
  },
  createArea: (area) => request('/api/areas', { method: 'POST', body: area, auth: true }),
  updateArea: (id, area) => request(`/api/areas/${id}`, { method: 'PUT', body: area, auth: true }),
  deleteArea: (id) => request(`/api/areas/${id}`, { method: 'DELETE', auth: true }),

  confirmTree: (treeId, status) =>
    request(`/api/trees/${treeId}/confirmations`, {
      method: 'POST',
      body: { status },
      auth: true,
    }),

  // Photo identification. `identifyConfig` says whether the feature is enabled
  // on this server (so the UI can hide it); `identifyPlant` posts a single photo
  // and returns ranked, form-ready suggestions.
  identifyConfig: () => request('/api/identify/config'),
  identifyPlant: (file) => {
    const form = new FormData()
    form.append('image', file)
    return request('/api/identify', { method: 'POST', body: form, auth: true })
  },

  uploadPhotos: (treeId, files) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    return request(`/api/trees/${treeId}/photos`, { method: 'POST', body: form, auth: true })
  },
  deletePhoto: (treeId, photoId) =>
    request(`/api/trees/${treeId}/photos/${photoId}`, { method: 'DELETE', auth: true }),

  // Admin-only: the admin panel. Dashboard stats, user management, moderation
  // over every plant/area, and a read-only SQL console. All require an admin JWT
  // (the backend returns 403 otherwise).
  adminStats: () => request('/api/admin/stats', { auth: true }),
  adminUsers: (q) =>
    request(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { auth: true }),
  adminSetUserRole: (userId, isAdmin) =>
    request(`/api/admin/users/${userId}`, { method: 'PATCH', body: { is_admin: isAdmin }, auth: true }),
  adminDeleteUser: (userId) =>
    request(`/api/admin/users/${userId}`, { method: 'DELETE', auth: true }),
  adminTrees: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== false) qs.set(key, value)
    }
    const suffix = qs.toString() ? `?${qs}` : ''
    return request(`/api/admin/trees${suffix}`, { auth: true })
  },
  adminDeleteTree: (treeId) =>
    request(`/api/admin/trees/${treeId}`, { method: 'DELETE', auth: true }),
  adminAreas: (q) =>
    request(`/api/admin/areas${q ? `?q=${encodeURIComponent(q)}` : ''}`, { auth: true }),
  adminDeleteArea: (areaId) =>
    request(`/api/admin/areas/${areaId}`, { method: 'DELETE', auth: true }),
  adminSql: (sql) => request('/api/admin/sql', { method: 'POST', body: { sql }, auth: true }),

  // Admin-only: export every plant inside a map rectangle. Returns the file as a
  // Blob plus a suggested filename and how many plants it contains.
  exportArea: async (bounds, format = 'geojson') => {
    const qs = new URLSearchParams({
      min_lat: bounds.min_lat,
      max_lat: bounds.max_lat,
      min_lng: bounds.min_lng,
      max_lng: bounds.max_lng,
      format,
    })
    const headers = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    const resp = await fetch(`/api/trees/export?${qs}`, { headers })
    if (!resp.ok) {
      let detail
      try {
        detail = (await resp.json())?.detail
      } catch {
        /* non-JSON error body */
      }
      const error = new Error(typeof detail === 'string' ? detail : `Export failed (${resp.status})`)
      error.status = resp.status
      throw error
    }

    const text = await resp.text()
    let count = Number(resp.headers.get('X-Export-Count'))
    if (!Number.isFinite(count)) {
      try {
        count = format === 'geojson'
          ? JSON.parse(text).features.length
          : Math.max(0, text.trim().split('\n').length - 1)
      } catch {
        count = 0
      }
    }
    const type = format === 'geojson' ? 'application/geo+json' : 'text/csv'
    return {
      blob: new Blob([text], { type }),
      count,
      filename: `florafind-export.${format === 'geojson' ? 'geojson' : 'csv'}`,
    }
  },
}
