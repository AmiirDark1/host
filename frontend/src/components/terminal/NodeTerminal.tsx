/**
 * WebSocket-based SSH terminal component with xterm.js integration.
 * Provides real-time terminal access to remote nodes directly in the browser,
 * supporting keyboard input, terminal resize, and ANSI escape sequence rendering.
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import '@xterm/xterm/css/xterm.css';

interface NodeTerminalProps {
  nodeId: string;
  nodeName: string;
  nodeHost: string;
  onClose: () => void;
}

export default function NodeTerminal({ nodeId, nodeName, nodeHost, onClose }: NodeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('No authentication token found');
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const apiPrefix = import.meta.env.VITE_API_PREFIX || '/api/v1';
    return `${protocol}//${host}${apiPrefix}/terminal/nodes/${nodeId}/terminal`;
  }, [nodeId]);

  const connectWebSocket = useCallback(async () => {
    const url = getWebSocketUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send authentication
        const token = localStorage.getItem('access_token');
        ws.send(JSON.stringify({
          type: 'auth',
          token: token,
        }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              setConnected(true);
              setError(null);
              if (terminalInstance.current) {
                terminalInstance.current.write(`\r\n\x1b[32m✓ Connected to ${nodeName} (${nodeHost})\x1b[0m\r\n\r\n`);
              }
              break;

            case 'output':
              if (terminalInstance.current) {
                terminalInstance.current.write(message.data);
              }
              break;

            case 'error':
              setError(message.message);
              if (terminalInstance.current) {
                terminalInstance.current.write(`\r\n\x1b[31m✗ Error: ${message.message}\x1b[0m\r\n`);
              }
              break;

            case 'pong':
              // Heartbeat response, no action needed
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (terminalInstance.current) {
          terminalInstance.current.write('\r\n\x1b[33m⚠ Connection closed\x1b[0m\r\n');
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed');
        setConnected(false);
      };
    } catch (e) {
      setError(`Failed to connect: ${e}`);
    }
  }, [getWebSocketUrl, nodeName, nodeHost]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'close' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

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
        brightBlack: '#545454',
        brightRed: '#f07178',
        brightGreen: '#c3e88d',
        brightYellow: '#ffcb6b',
        brightBlue: '#82aaff',
        brightMagenta: '#c792ea',
        brightCyan: '#89ddff',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
      cols: 120,
      rows: 40,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    fitAddonRef.current = fitAddon;

    term.open(terminalRef.current);
    fitAddon.fit();
    terminalInstance.current = term;

    // Handle terminal input
    term.onData((data: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: data,
        }));
      }
    });

    // Handle terminal resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dimensions = fitAddonRef.current.proposeDimensions();
        if (dimensions && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: dimensions.cols,
            rows: dimensions.rows,
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Connect to WebSocket
    connectWebSocket();

    return () => {
      window.removeEventListener('resize', handleResize);
      disconnectWebSocket();
      term.dispose();
      terminalInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev: boolean) => !prev);
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);
  }, []);

  // Handle reconnect
  const handleReconnect = useCallback(() => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
    }
    setError(null);
    setConnected(false);
    disconnectWebSocket();
    setTimeout(() => connectWebSocket(), 500);
  }, [connectWebSocket, disconnectWebSocket]);

  return (
    <div className={`bg-[#1a1b2e] rounded-lg border border-gray-700/50 overflow-hidden ${
      fullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
    }`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0f1023] border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 cursor-pointer transition-colors"
                 onClick={onClose} />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 cursor-pointer transition-colors" />
            <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-400 cursor-pointer transition-colors" />
          </div>
          <span className="text-sm text-gray-300 font-medium">
            SSH: {nodeName} ({nodeHost})
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            connected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white h-7 w-7 p-0"
            onClick={handleReconnect}
            title="Reconnect"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white h-7 w-7 p-0"
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white h-7 w-7 p-0"
            onClick={onClose}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={terminalRef}
        className="w-full"
        style={{ height: fullscreen ? 'calc(100vh - 40px)' : '400px' }}
      />

      {/* Error Bar */}
      {error && (
        <div className="px-4 py-1.5 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between">
          <span className="text-xs text-red-400">{error}</span>
          <button
            onClick={handleReconnect}
            className="text-xs text-red-300 hover:text-red-200 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Connection Bar */}
      <div className="px-4 py-1.5 bg-[#0f1023] border-t border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            Node: <span className="text-gray-300 font-mono">{nodeName}</span>
          </span>
          <span>
            Host: <span className="text-gray-300 font-mono">{nodeHost}:22</span>
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {connected ? (
            <span className="text-green-500">● Live session</span>
          ) : (
            <span className="text-red-500">● Disconnected</span>
          )}
        </div>
      </div>
    </div>
  );
}