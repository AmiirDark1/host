"""WebSocket-based SSH terminal component with xterm.js integration.

Provides real-time terminal access to remote nodes directly in the browser,
supporting keyboard input, terminal resize, and proper ANSI escape sequence rendering.
"""

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

import '@xterm/xterm/css/xterm.css'

interface NodeTerminalProps {
  nodeId: string
  nodeName: string
  nodeHost: string
  onClose: () => void
}

export default function NodeTerminal({ nodeId, nodeName, nodeHost, onClose }: NodeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getWebSocketUrl = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setError('No authentication token found')
      return null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const apiPrefix = import.meta.env.VITE_API_PREFIX || '/api/v1'
    return `${protocol}//${host}${apiPrefix}/terminal/nodes/${nodeId}/terminal`
  }, [nodeId])

  const connectWebSocket = useCallback(async () => {
    const url = getWebSocketUrl()
    if (!url) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        // Send authentication
        const token = localStorage.getItem('access_token')
        ws.send(JSON.stringify({
          type: 'auth',
          token: token,
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          switch (message.type) {
            case 'connected':
              setConnected(true)
              setError(null)
              if (terminalInstance.current) {
                terminalInstance.current.write(`\r\n\x1b[32m✓ Connected to ${nodeName} (${nodeHost})\x1b[0m\r\n\r\n`)
              }
              break

            case 'output':
              if (terminalInstance.current) {
                terminalInstance.current.write(message.data)
              }
              break

            case 'error':
              setError(message.message)
              if (terminalInstance.current) {
                terminalInstance.current.write(`\r\n\x1b[31m✗ Error: ${message.message}\x1b[0m\r\n`)
              }
              break

            case 'pong':
              // Heartbeat response, no action needed
              break
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (terminalInstance.current) {
          terminalInstance.current.write('\r\n\x1b[33m⚠ Connection closed\x1b[0m\r\n')
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection failed')
        setConnected(false)
      }
    } catch (e) {
      setError(`Failed to connect: ${e}`)
    }
  }, [getWebSocketUrl, nodeName, nodeHost])

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'close' }))
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      theme: {
        background: '#1a1b2e',
        foreground: '#e0e0e0',
        cursor: '#ffffff',
        selectionBackground: '#4a4a6a',
        black: '#1a1b2e',
        red: '#f07178',
        green: '#c3e88d',
        yellow: '#ffcb6b',
        blue: '#82aaff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#ffffff',
