import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { auth } from './firebase'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1'

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
})

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token inválido / expirado: el AuthContext detectará el cambio de sesión.
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export type ApiError = AxiosError<{ message?: string; error?: string }>
