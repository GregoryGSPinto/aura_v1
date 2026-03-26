'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clientEnv } from '@/lib/env';

type EventHandler = (event: Record<string, unknown>) => void;

type UseWebSocketReturn = {
  connected: boolean;
  on: (eventType: string, handler: EventHandler) => () => void;
  send: (data: Record<string, unknown>) => void;
};

/**
 * WebSocket hook with auto-reconnect and event dispatching.
 *
 * Connects to /api/v1/ws/{sessionId} on the backend.
 * Falls back gracefully — chat still works via HTTP POST if WS fails.
 */
export function useWebSocket(sessionId: string): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlers = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30_000;
  const mountedRef = useRef(true);

  const getWsUrl = useCallback(() => {
    const base = clientEnv.apiUrl || 'http://localhost:8000';
    const wsBase = base.replace(/^http/, 'ws');
    const token = clientEnv.auraToken || '';
    return `${wsBase}/api/v1/ws/${sessionId}?token=${encodeURIComponent(token)}`;
  }, [sessionId]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (ws.current && ws.current.readyState <= WebSocket.OPEN) return;

    try {
      const url = getWsUrl();
      const socket = new WebSocket(url);

      socket.onopen = () => {
        if (!mountedRef.current) { socket.close(); return; }
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        ws.current = null;

        // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, maxReconnectDelay);
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };

      socket.onerror = () => {
        // onclose will fire after this — reconnect handled there
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          const type = data.type as string;

          // Dispatch to type-specific handlers
          const typeHandlers = handlers.current.get(type);
          if (typeHandlers) {
            typeHandlers.forEach((handler) => handler(data));
          }

          // Dispatch to wildcard handlers
          const wildcardHandlers = handlers.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(data));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.current = socket;
    } catch {
      // WebSocket constructor can throw if URL is invalid
      setConnected(false);
    }
  }, [getWsUrl]);

  const on = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlers.current.has(eventType)) {
      handlers.current.set(eventType, new Set());
    }
    handlers.current.get(eventType)!.add(handler);

    return () => {
      handlers.current.get(eventType)?.delete(handler);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws.current) {
        ws.current.onclose = null; // prevent reconnect on intentional close
        ws.current.close();
        ws.current = null;
      }
      setConnected(false);
    };
  }, [connect]);

  return { connected, on, send };
}
