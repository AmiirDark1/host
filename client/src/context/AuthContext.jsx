import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API_BASE = '/api'

// ذخیره توکن در localStorage
function getStoredUser() {
  try {
    const stored = localStorage.getItem('wp_user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function getStoredToken() {
  return localStorage.getItem('wp_token')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)
  const [token, setToken] = useState(getStoredToken)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isAdmin = user?.role === 'admin'

  // ذخیره در localStorage هر وقت تغییر کرد
  useEffect(() => {
    if (user) {
      localStorage.setItem('wp_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('wp_user')
    }
  }, [user])

  useEffect(() => {
    if (token) {
      localStorage.setItem('wp_token', token)
    } else {
      localStorage.removeItem('wp_token')
    }
  }, [token])

  async function login(username, password) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در ورود')
      setUser(data.user)
      setToken(data.token)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('wp_user')
    localStorage.removeItem('wp_token')
  }

  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  }

  async function apiCall(url, options = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 401) {
        logout()
        throw new Error('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.')
      }
      throw new Error(data.error || `خطا: ${res.status}`)
    }
    return data
  }

  return (
    <AuthContext.Provider value={{
      user, token, loading, error, isAdmin,
      login, logout, apiCall, getHeaders,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}