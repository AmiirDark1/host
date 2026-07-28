import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function truncate(str: string, length = 100): string {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-green-500 bg-green-500/10',
    inactive: 'text-gray-500 bg-gray-500/10',
    suspended: 'text-yellow-500 bg-yellow-500/10',
    creating: 'text-blue-500 bg-blue-500/10',
    deleting: 'text-red-500 bg-red-500/10',
    failed: 'text-red-500 bg-red-500/10',
    running: 'text-green-500 bg-green-500/10',
    pending: 'text-yellow-500 bg-yellow-500/10',
    completed: 'text-green-500 bg-green-500/10',
    healthy: 'text-green-500 bg-green-500/10',
    unhealthy: 'text-red-500 bg-red-500/10',
    drain: 'text-yellow-500 bg-yellow-500/10',
    maintenance: 'text-orange-500 bg-orange-500/10',
  }
  return colors[status] || 'text-gray-500 bg-gray-500/10'
}