import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearSession, getStoredUser, getToken, storeSession } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)

  useEffect(() => {
    // Validate the stored token on load; drop it if expired.
    if (getToken()) {
      api
        .me()
        .then(setUser)
        .catch(() => {
          clearSession()
          setUser(null)
        })
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password)
    storeSession(data.access_token, data.user)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email, username, password) => {
    const data = await api.register(email, username, password)
    storeSession(data.access_token, data.user)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
