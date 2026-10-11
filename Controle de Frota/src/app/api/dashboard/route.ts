import { NextResponse } from 'next/server';
import { loadFleet } from '@/lib/crud';
import { computeDashboardMetrics } from '@/mock-data';
import { FreightTrip } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fleet = await loadFleet();
    const metrics = computeDashboardMetrics({
      trucks: fleet.trucks,
      fuelLogs: fleet.fuelLogs,
      maintenanceLogs: fleet.maintenanceLogs,
      trips: (fleet.trips as FreightTrip[]).filter((t) => t.status !== 'CANCELADO'),
    });
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ error: 'Erro ao calcular métricas do dashboard' }, { status: 500 });
  }
}
