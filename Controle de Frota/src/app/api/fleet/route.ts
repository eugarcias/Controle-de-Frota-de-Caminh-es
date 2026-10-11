import { NextResponse } from 'next/server';
import { loadFleet } from '@/lib/crud';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadFleet());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Não foi possível conectar ao banco de dados.' }, { status: 503 });
  }
}
