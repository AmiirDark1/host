import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = useAuthStore.getState().refreshToken

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh`, {
            refresh_token: refreshToken,
          })

          const { access_token, refresh_token } = response.data
          useAuthStore.getState().setTokens(access_token, refresh_token)

          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        } catch {
          useAuthStore.getState().logout()
        }
      }
    }

    return Promise.reject(error)
  }
)

// API Endpoints
export const authAPI = {
  register: (data: { email: string; username: string; password: string; first_name?: string; last_name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/token/refresh', { refresh_token: refreshToken }),
  getProfile: () => api.get('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/password/change', data),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (code: string) => api.post('/auth/2fa/verify', { code }),
  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),
}

export const usersAPI = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/users', { params }),
  get: (id: string) => api.get(`/admin/users/${id}`),
  create: (data: any) => api.post('/admin/users', data),
  update: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
  delete: (id: string) => api.delete(`/admin/users/${id}`),
}

export const plansAPI = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/plans', { params }),
  get: (id: string) => api.get(`/admin/plans/${id}`),
  create: (data: any) => api.post('/admin/plans', data),
  update: (id: string, data: any) => api.put(`/admin/plans/${id}`, data),
  delete: (id: string) => api.delete(`/admin/plans/${id}`),
  getPublic: () => api.get('/plans'),
}

export const nodesAPI = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/nodes', { params }),
  get: (id: string) => api.get(`/admin/nodes/${id}`),
  create: (data: any) => api.post('/admin/nodes', data),
  update: (id: string, data: any) => api.put(`/admin/nodes/${id}`, data),
  delete: (id: string) => api.delete(`/admin/nodes/${id}`),
  getStats: (id: string) => api.get(`/admin/nodes/${id}/stats`),
  checkHealth: (id: string) => api.post(`/admin/nodes/${id}/health`),
}

export const websitesAPI = {
  list: (params?: { page?: number; limit?: number; user_id?: string }) =>
    api.get('/admin/websites', { params }),
  get: (id: string) => api.get(`/websites/${id}`),
  action: (id: string, action: string) => api.post(`/websites/${id}/${action}`),
  create: (data: any) => api.post('/websites', data),
  delete: (id: string) => api.delete(`/websites/${id}`),
  start: (id: string) => api.post(`/websites/${id}/start`),
  stop: (id: string) => api.post(`/websites/${id}/stop`),
  restart: (id: string) => api.post(`/websites/${id}/restart`),
  getStats: (id: string) => api.get(`/websites/${id}/stats`),
  getBackups: (id: string) => api.get(`/websites/${id}/backups`),
  createBackup: (id: string, type?: string) => api.post(`/websites/${id}/backups`, { type }),
  restoreBackup: (id: string, backupId: string) => api.post(`/websites/${id}/backups/${backupId}/restore`),
  myWebsites: () => api.get('/websites'),
}

export const ordersAPI = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/orders', { params }),
  get: (id: string) => api.get(`/admin/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.put(`/admin/orders/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/admin/orders/${id}/status`, { status }),
  myOrders: () => api.get('/orders'),
}

export const invoicesAPI = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/invoices', { params }),
  get: (id: string) => api.get(`/invoices/${id}`),
  myInvoices: () => api.get('/invoices'),
}

export const ticketsAPI = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/tickets', { params }),
  get: (id: string) => api.get(`/tickets/${id}`),
  create: (data: any) => api.post('/tickets', data),
  reply: (id: string, data: any) => api.post(`/tickets/${id}/reply`, data),
  myTickets: () => api.get('/tickets'),
}

export const monitoringAPI = {
  getDashboard: () => api.get('/monitoring/dashboard'),
  getAlerts: (params?: { page?: number; limit?: number }) =>
    api.get('/monitoring/alerts', { params }),
  getMetrics: (params: { resource_type: string; resource_id: string; metric: string; period?: string }) =>
    api.get('/monitoring/metrics', { params }),
}


export const dashboardAPI = {
  getStats: () => api.get('/admin/dashboard/stats'),
}

export default api
