'use client';

/**
 * Terminal Panel — Terminal real conectado ao Mac via WebSocket.
 *
 * Features:
 * - Conexão WebSocket persistente
 * - Output com cores ANSI
 * - Prompt estilizado com cwd
 * - Histórico de comandos (seta cima/baixo)
 * - Ctrl+C envia SIGINT
 * - Ctrl+L limpa
 * - Auto-scroll
 * - Reconexão automática
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Wifi, WifiOff, Trash2 } from 'lucide-react';

import { parseAnsi } from '@/components/terminal/ansi-parser';
import { useTerminalStore } from '@/lib/terminal-store';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';

function getWsUrl(): string {
  const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  const wsBase = base.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  const prefix = wsBase.endsWith('/api/v1') ? wsBase : `${wsBase}/api/v1`;
  return prefix;
}

function shortenCwd(cwd: string): string {
  const home = '/Users/user_pc';
  if (cwd === home) return '~';
  if (cwd.startsWith(home + '/')) return '~' + cwd.slice(home.length);
  return cwd;
}

export function TerminalPanel() {
  const token = useAuthStore((s) => s.token) || clientEnv.auraToken;
  const {
    lines, addLine, clearLines, history, addHistory,
    historyIndex, setHistoryIndex, cwd, setCwd,
    connected, setConnected,
  } = useTerminalStore();

  const [input, setInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll when lines change
  useEffect(() => {
    scrollToBottom();
  }, [lines.length, scrollToBottom]);

  // Focus input on click
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // WebSocket connection
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = `${getWsUrl()}/terminal/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setConnected(true);
      addLine({ type: 'system', content: 'Conectado ao terminal.' });
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          setCwd(msg.cwd);
        } else if (msg.type === 'output') {
          addLine({ type: 'output', content: msg.content });
        } else if (msg.type === 'prompt') {
          setCwd(msg.cwd);
        } else if (msg.type === 'exit_code') {
          addLine({ type: 'system', content: `Processo encerrou com código ${msg.code}` });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      addLine({ type: 'system', content: 'Desconectado. Reconectando em 3s...' });
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    };

    ws.onerror = () => {
      // onclose will fire after this
    };

    wsRef.current = ws;
  }, [token, setConnected, setCwd, addLine]);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendCommand = useCallback((cmd: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    addLine({ type: 'input', content: cmd, source: 'user' });
    addHistory(cmd);

    wsRef.current.send(JSON.stringify({ type: 'command', command: cmd }));
    setInput('');
    setHistoryIndex(-1);
  }, [addLine, addHistory, setHistoryIndex]);

  const sendSignal = useCallback((sig: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'signal', signal: sig }));
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) sendCommand(input.trim());
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIdx);
      setInput(history[newIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIdx = historyIndex + 1;
      if (newIdx >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIdx);
        setInput(history[newIdx] || '');
      }
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      sendSignal('SIGINT');
      addLine({ type: 'system', content: '^C' });
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      clearLines();
    }
  };

  const shortCwd = shortenCwd(cwd);

  return (
    <div
      className="flex h-full flex-col bg-zinc-950 font-mono text-sm"
      onClick={focusInput}
    >
      {/* Terminal header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className="text-xs text-zinc-500">Terminal</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); clearLines(); }}
          className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          title="Limpar terminal (Ctrl+L)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin"
      >
        {lines.map((line) => (
          <div key={line.id} className="whitespace-pre-wrap break-all leading-5">
            {line.type === 'input' ? (
              <div>
                <span className={line.source === 'aura' ? 'text-purple-400' : 'text-green-400'}>
                  {line.source === 'aura' ? 'aura' : 'gregory'}@mac:{shortCwd}${' '}
                </span>
                <span className="text-zinc-200">{line.content}</span>
              </div>
            ) : line.type === 'system' ? (
              <span className="text-zinc-600 italic">{line.content}</span>
            ) : (
              <span>
                {parseAnsi(line.content).map((span, i) => (
                  <span key={i} className={span.className}>{span.text}</span>
                ))}
              </span>
            )}
          </div>
        ))}

        {/* Input line */}
        <div className="flex items-center whitespace-pre leading-5">
          <span className="text-green-400">
            gregory@mac:{shortCwd}${' '}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-zinc-200 outline-none caret-green-400"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
