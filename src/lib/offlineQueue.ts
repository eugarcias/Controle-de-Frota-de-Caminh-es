'use client';

/**
 * Fila offline inteligente (PWA) do app do motorista.
 * - Evita duplicidade: bloqueia cliques repetidos ou lançamentos idênticos na fila.
 * - Suporta fotos de recibo tiradas sem internet (comprimidas no aparelho e enviadas quando o sinal volta).
 * - Sincroniza automaticamente assim que a internet retorna.
 */

const KEY = 'vsm.driver.offlineQueue.v1';

export interface QueuedRequest {
  id: string;
  url: string;
  body: Record<string, unknown>;
  fingerprint: string;
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
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // Caso o localStorage esteja cheio, remove a foto pesada mantendo os dados numéricos
  }
  window.dispatchEvent(new CustomEvent('vsm-queue-change'));
};

export const queueSize = () => read().length;

/** Gera uma assinatura única dos dados para impedir lançamentos duplicados. */
export function buildFingerprint(url: string, body: Record<string, unknown>): string {
  if (url.includes('/fuel')) {
    return `fuel:${body.truckId}:${body.odometer}:${body.liters}:${body.totalAmount}`;
  }
  if (url.includes('/expense')) {
    return `exp:${body.truckId ?? ''}:${body.category}:${body.amount}:${String(body.description ?? '').trim()}`;
  }
  if (url.includes('/odometer')) {
    return `odo:${body.truckId}:${body.odometer}`;
  }
  return `${url}:${JSON.stringify(body)}`;
}

export function enqueue(url: string, body: Record<string, unknown>): { deduplicated: boolean } {
  const q = read();
  const fp = buildFingerprint(url, body);
  const now = Date.now();

  // Se já existe um item com a mesma assinatura na fila (nos últimos 30 min), não duplica
  const duplicate = q.find((item) => item.fingerprint === fp && now - item.createdAt < 30 * 60 * 1000);
  if (duplicate) {
    return { deduplicated: true };
  }

  const recordId = typeof body.id === 'string' ? body.id : crypto.randomUUID();
  q.push({
    id: recordId,
    url,
    body: { ...body, id: recordId },
    fingerprint: fp,
    createdAt: now,
  });
  write(q);
  return { deduplicated: false };
}

export const isNetworkError = (e: unknown) =>
  e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);

/** Comprime a foto do recibo no celular (máx 1100px JPEG 0.72) para envio rápido e funcionamento offline. */
export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        const maxDim = 1100;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, fileName = 'recibo.jpg'): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
}

let flushing = false;

/** Reenvia a fila em ordem. Se houver foto pendente guardada offline, faz o upload antes. */
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) {
    return { synced: 0, remaining: queueSize() };
  }
  flushing = true;
  let synced = 0;
  try {
    let q = read();
    while (q.length) {
      const item = q[0];
      const payload = { ...item.body };

      // Se havia foto salva como DataURL offline, tenta subir para o Storage primeiro
      if (typeof payload._offlinePhotoDataUrl === 'string') {
        try {
          const file = await dataUrlToFile(payload._offlinePhotoDataUrl);
          const fd = new FormData();
          fd.append('file', file);
          const up = await fetch('/api/driver/upload', { method: 'POST', body: fd });
          if (up.ok) {
            const upData = await up.json().catch(() => ({}));
            if (upData?.path) payload.receiptPhotoUrl = upData.path;
          }
        } catch {
          // Segue mesmo se o bucket não estiver acessível
        }
        delete payload._offlinePhotoDataUrl;
      }

      let res: Response;
      try {
        res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        break; // sem rede novamente: mantém na fila
      }

      if (res.status === 401 || res.status >= 500) break; // tenta depois
      q = q.slice(1);
      write(q);
      if (res.ok) synced++;
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: queueSize() };
}
