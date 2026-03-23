'use client';

interface QueuedItem {
  id: string;
  type: 'chat' | 'terminal' | 'file_save';
  endpoint: string;
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  timestamp: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retries: number;
}

const DB_NAME = 'aura_offline';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

class OfflineQueue {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (typeof window === 'undefined' || !window.indexedDB) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async enqueue(
    type: QueuedItem['type'],
    endpoint: string,
    options: QueuedItem['options'],
  ): Promise<string> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not available');

    const item: QueuedItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      endpoint,
      options,
      timestamp: Date.now(),
      status: 'pending',
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve(item.id);
      req.onerror = () => reject(req.error);
    });
  }

  async processQueue(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    const items = await this.getAll();
    const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed');
    let processed = 0;

    for (const item of pending) {
      if (item.retries >= 3) {
        await this.updateStatus(item.id, 'failed');
        continue;
      }

      await this.updateStatus(item.id, 'sending');

      try {
        const response = await fetch(item.endpoint, {
          method: item.options.method || 'POST',
          headers: item.options.headers,
          body: item.options.body,
        });

        if (response.ok) {
          await this.remove(item.id);
          processed++;
        } else {
          await this.incrementRetry(item.id);
        }
      } catch {
        await this.incrementRetry(item.id);
      }
    }

    return processed;
  }

  async getQueueSize(): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  }

  private async getAll(): Promise<QueuedItem[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as QueuedItem[]);
      req.onerror = () => resolve([]);
    });
  }

  private async updateStatus(id: string, status: QueuedItem['status']): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result as QueuedItem | undefined;
        if (item) {
          item.status = status;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  private async incrementRetry(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result as QueuedItem | undefined;
        if (item) {
          item.retries++;
          item.status = 'pending';
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  private async remove(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

export const offlineQueue = new OfflineQueue();
