import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getFleetMonthlyFuelPerformance, getMonthlyTruckFuelPerformance } from '@/lib/fuelPerformance';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  truckId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

/**
 * GET /api/fuel-performance?truck_id=<uuid>&month=<1..12>&year=<YYYY>
 * Também aceita ?truckId=<uuid>&mes=<1..12>&ano=<YYYY>.
 * Se `truck_id` for omitido, retorna a lista consolidada de todos os caminhões para o mês/ano.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    const parsed = QuerySchema.parse({
      truckId: searchParams.get('truck_id') ?? searchParams.get('truckId') ?? undefined,
      month: searchParams.get('month') ?? searchParams.get('mes') ?? now.getUTCMonth() + 1,
      year: searchParams.get('year') ?? searchParams.get('ano') ?? now.getUTCFullYear(),
    });

    if (parsed.truckId) {
      const result = await getMonthlyTruckFuelPerformance({
        truckId: parsed.truckId,
        month: parsed.month,
        year: parsed.year,
      });
      return NextResponse.json(result);
    }

    const fleetResults = await getFleetMonthlyFuelPerformance({
      month: parsed.month,
      year: parsed.year,
    });
    return NextResponse.json(fleetResults);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') },
        { status: 400 }
      );
    }
    console.error('Erro ao calcular desempenho mensal de combustível:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular desempenho mensal de combustível.' },
      { status: 500 }
    );
  }
}
