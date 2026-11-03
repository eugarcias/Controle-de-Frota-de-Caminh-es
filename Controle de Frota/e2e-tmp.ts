// Teste e2e temporário: login -> cria cliente -> cria agendamento com o id devolvido -> limpa tudo.
import { createServerClient } from '@supabase/ssr';

const BASE = 'http://localhost:3123';
const jar = new Map<string, string>();

async function main() {
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email: 'teste@frota.com', password: 'Teste@123456' });
  if (error) throw error;
  const cookie = [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  const api = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(BASE + path, { ...init, headers: { cookie, 'content-type': 'application/json' } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  const clientId = crypto.randomUUID();
  const cust = await api('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ id: clientId, name: 'Cliente Teste E2E', contactName: 'Cliente Teste E2E', phone: '11999990000', cnpj: null, email: '', city: 'Campinas', state: 'SP', paymentTermsDays: 30 }),
  });
  console.log('CLIENTE', cust.status, 'id do banco difere do id local:', cust.body?.id !== clientId);

  const sched = await api('/api/cargo-schedules', {
    method: 'POST',
    body: JSON.stringify({
      customerId: cust.body.id, truckId: null, driverId: null, origin: 'Campinas/SP', destination: 'Curitiba/PR',
      distanceKm: 500, cargoDescription: 'Teste', cargoWeightKg: 1000, pickupDate: '2026-11-10T07:00:00.000Z',
      deliveryDate: null, freightValue: 5000, status: 'AGENDADA', notes: '',
    }),
  });
  console.log('AGENDAMENTO', sched.status, sched.body?.customerId === cust.body.id ? 'vinculado ao cliente OK' : JSON.stringify(sched.body));

  const d1 = await api(`/api/cargo-schedules/${sched.body?.id}`, { method: 'DELETE' });
  const d2 = await api(`/api/customers/${cust.body?.id}`, { method: 'DELETE' });
  console.log('LIMPEZA', d1.status, d2.status);

  for (const p of ['/manifest.webmanifest', '/icons/icon-192.png', '/sw.js']) {
    const r = await fetch(BASE + p);
    console.log('ASSET', p, r.status, r.headers.get('content-type'));
  }
  const home = await fetch(BASE + '/', { headers: { cookie } });
  console.log('HOME logado', home.status, home.url);
}

main().catch((e) => { console.error('FALHA', e); process.exit(1); });
