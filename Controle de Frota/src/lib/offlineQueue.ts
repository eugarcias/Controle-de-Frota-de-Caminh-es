'use client';

/**
 * Fila offline (PWA) do app do motorista.
 * - Se não há internet (ou o fetch falha por rede), o lançamento é guardado no localStorage.
 * - Ao voltar a conexão (evento `online`) ou ao abrir o app, a fila é reenviada em ordem.
 * - Erros de validação do servidor (4xx) descartam o item para não travar a fila.
 */

const KEY = 'vsm.driver.offlineQueue.v1';

export interface QueuedRequest {
  id: string;
  url: string;
  body: unknown;
  createdAt: number;
}

const read = (): QueuedRequest[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};
const write = (q: QueuedRequest[]) => {
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent('vsm-queue-change'));
};

export const queueSize = () => read().length;

export function enqueue(url: string, body: unknown) {
  const q = read();
  q.push({ id: crypto.randomUUID(), url, body, createdAt: Date.now() });
  write(q);
}

export const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);

let flushing = false;

/** Reenvia a fila. Retorna quantos itens foram sincronizados. */
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) return { synced: 0, remaining: queueSize() };
  flushing = true;
  let synced = 0;
  try {
    let q = read();
    while (q.length) {
      const item = q[0];
      let res: Response;
      try {
        res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });
      } catch {
        break; // sem rede de novo: mantém o restante
      }
      if (res.status === 401 || res.status >= 500) break; // sessão expirada / servidor fora: tenta depois
      q = q.slice(1); // 2xx ok; 4xx = item inválido, descarta
      write(q);
      if (res.ok) synced++;
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: queueSize() };
}
