'use server';

import { prisma } from './prisma';
import { evaluateMonthlyAnomaly, formatPeriodLabel } from './calc';

export interface MonthlyFuelPerformanceResult {
  // Identificadores e período
  truck_id: string;
  truckId: string;
  month: number;
  year: number;
  period_label: string;
  periodLabel: string;
  logs_count: number;
  logsCount: number;

  // Métricas exigidas (snake_case + camelCase para compatibilidade total)
  total_liters: number;
  totalLiters: number;
  start_odometer: number;
  startOdometer: number;
  end_odometer: number;
  endOdometer: number;
  distance_traveled: number;
  distanceTraveled: number;
  monthly_avg_km_l: number;
  monthlyAvgKmL: number;
  total_fuel_cost: number;
  totalFuelCost: number;
  fuel_cpk: number;
  fuelCpk: number;

  // Alerta de anomalia (< 2,0 km/L ou > 4,5 km/L em mês com > 1.000 km rodados)
  is_anomalous: boolean;
  isAnomalous: boolean;
  anomaly_type: 'LOW' | 'HIGH' | null;
  anomalyType: 'LOW' | 'HIGH' | null;
  anomaly_message: string | null;
  anomalyMessage: string | null;
}

function getMonthUtcBounds(month: number, year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

function formatResult(
  truckId: string,
  month: number,
  year: number,
  logsCount: number,
  rawLiters: number,
  rawFuelCost: number,
  minOdo: number | null,
  maxOdo: number | null
): MonthlyFuelPerformanceResult {
  const totalLiters = Number(rawLiters.toFixed(2));
  const totalFuelCost = Number(rawFuelCost.toFixed(2));
  const startOdometer = minOdo ?? 0;
  const endOdometer = maxOdo ?? 0;
  const distanceTraveled = Math.max(0, endOdometer - startOdometer);

  const rawKmL = totalLiters > 0 && distanceTraveled > 0 ? distanceTraveled / totalLiters : 0;
  const rawFuelCpk = distanceTraveled > 0 ? totalFuelCost / distanceTraveled : 0;

  const monthlyAvgKmL = Number(rawKmL.toFixed(2));
  const fuelCpk = Number(rawFuelCpk.toFixed(2));
  const periodLabel = formatPeriodLabel(month, year);
  const anomaly = evaluateMonthlyAnomaly(distanceTraveled, monthlyAvgKmL, periodLabel);

  return {
    truck_id: truckId,
    truckId,
    month,
    year,
    period_label: periodLabel,
    periodLabel,
    logs_count: logsCount,
    logsCount,
    total_liters: totalLiters,
    totalLiters,
    start_odometer: startOdometer,
    startOdometer,
    end_odometer: endOdometer,
    endOdometer,
    distance_traveled: distanceTraveled,
    distanceTraveled,
    monthly_avg_km_l: monthlyAvgKmL,
    monthlyAvgKmL,
    total_fuel_cost: totalFuelCost,
    totalFuelCost,
    fuel_cpk: fuelCpk,
    fuelCpk,
    is_anomalous: anomaly.isAnomalous,
    isAnomalous: anomaly.isAnomalous,
    anomaly_type: anomaly.anomalyType,
    anomalyType: anomaly.anomalyType,
    anomaly_message: anomaly.anomalyMessage,
    anomalyMessage: anomaly.anomalyMessage,
  };
}

/**
 * Server Action / Query otimizada no banco (usa o índice composto `@@index([truckId, date])`).
 * Calcula em uma única query SQL: SUM(liters), MIN(odometer), MAX(odometer) e SUM(total_amount).
 */
export async function getMonthlyTruckFuelPerformance(params: {
  truckId: string;
  month: number;
  year: number;
}): Promise<MonthlyFuelPerformanceResult> {
  const { truckId, month, year } = params;
  const { start, end } = getMonthUtcBounds(month, year);

  const agg = await prisma.fuelLog.aggregate({
    where: {
      truckId,
      date: {
        gte: start,
        lt: end,
      },
    },
    _sum: {
      liters: true,
      totalAmount: true,
    },
    _min: {
      odometer: true,
    },
    _max: {
      odometer: true,
    },
    _count: {
      _all: true,
    },
  });

  return formatResult(
    truckId,
    month,
    year,
    agg._count._all,
    Number(agg._sum.liters ?? 0),
    Number(agg._sum.totalAmount ?? 0),
    agg._min.odometer,
    agg._max.odometer
  );
}

/**
 * Calcula o desempenho mensal acumulado de todos os caminhões da frota em uma única query GROUP BY.
 */
export async function getFleetMonthlyFuelPerformance(params: {
  month: number;
  year: number;
}): Promise<MonthlyFuelPerformanceResult[]> {
  const { month, year } = params;
  const { start, end } = getMonthUtcBounds(month, year);

  const [trucks, groups] = await Promise.all([
    prisma.truck.findMany({ select: { id: true }, orderBy: { plate: 'asc' } }),
    prisma.fuelLog.groupBy({
      by: ['truckId'],
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        liters: true,
        totalAmount: true,
      },
      _min: {
        odometer: true,
      },
      _max: {
        odometer: true,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const byTruck = new Map(groups.map((g) => [g.truckId, g]));

  return trucks.map((t) => {
    const g = byTruck.get(t.id);
    return formatResult(
      t.id,
      month,
      year,
      g?._count._all ?? 0,
      Number(g?._sum.liters ?? 0),
      Number(g?._sum.totalAmount ?? 0),
      g?._min.odometer ?? null,
      g?._max.odometer ?? null
    );
  });
}
