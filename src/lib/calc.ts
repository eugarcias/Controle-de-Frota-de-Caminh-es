import { FuelLog, MaintenanceAlert, MonthlyFuelPerformance, Truck, MaintenanceLog } from '../types';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function formatPeriodLabel(month: number, year: number): string {
  const m = MONTH_NAMES[Math.max(0, Math.min(11, month - 1))] ?? String(month).padStart(2, '0');
  return `${m}/${year}`;
}

/**
 * 1. MOTOR DE CÁLCULO PELO MÉTODO DE MÉDIA MENSAL ACUMULADA
 *
 * Fórmulas padronizadas:
 *  1. total_liters      = SUM(liters) para o período selecionado
 *  2. start_odometer    = MIN(odometer) do primeiro registro do período
 *  3. end_odometer      = MAX(odometer) do último registro do período
 *  4. distance_traveled = end_odometer - start_odometer
 *  5. monthly_avg_km_l  = distance_traveled / total_liters (0 se total_liters == 0)
 *  6. total_fuel_cost   = SUM(total_amount)
 *  7. fuel_cpk          = total_fuel_cost / distance_traveled (0 se distance_traveled <= 0)
 *
 * Alerta de anomalia:
 *  Se distance_traveled > 1.000 km e (monthly_avg_km_l < 2,0 ou monthly_avg_km_l > 4,5),
 *  sinaliza alerta sugerindo conferência de notas ou revisão do veículo.
 */
export function evaluateMonthlyAnomaly(
  distanceTraveled: number,
  monthlyAvgKmL: number,
  periodLabel?: string
): {
  isAnomalous: boolean;
  anomalyType: 'LOW' | 'HIGH' | null;
  anomalyMessage: string | null;
} {
  if (distanceTraveled <= 1000 || monthlyAvgKmL <= 0) {
    return { isAnomalous: false, anomalyType: null, anomalyMessage: null };
  }
  const ref = periodLabel ? ` (${periodLabel})` : '';
  const fmtKmL = monthlyAvgKmL.toFixed(1).replace('.', ',');
  if (monthlyAvgKmL < 2.0) {
    return {
      isAnomalous: true,
      anomalyType: 'LOW',
      anomalyMessage: `Média baixa de ${fmtKmL} km/L${ref} (> 1.000 km rodados) — sugerida conferência de notas ou revisão do veículo.`,
    };
  }
  if (monthlyAvgKmL > 4.5) {
    return {
      isAnomalous: true,
      anomalyType: 'HIGH',
      anomalyMessage: `Média atípica de ${fmtKmL} km/L${ref} (> 1.000 km rodados) — sugerida conferência de notas ou revisão do veículo.`,
    };
  }
  return { isAnomalous: false, anomalyType: null, anomalyMessage: null };
}

export function calculateCumulativeFuelStats(
  logs: Pick<FuelLog, 'odometer' | 'liters' | 'totalAmount'>[],
  periodLabel?: string
) {
  if (logs.length === 0) {
    return {
      logsCount: 0,
      totalLiters: 0,
      startOdometer: 0,
      endOdometer: 0,
      distanceTraveled: 0,
      monthlyAvgKmL: 0,
      totalFuelCost: 0,
      fuelCpk: 0,
      isAnomalous: false,
      anomalyType: null as 'LOW' | 'HIGH' | null,
      anomalyMessage: null as string | null,
    };
  }

  let totalLiters = 0;
  let totalFuelCost = 0;
  let startOdometer = Infinity;
  let endOdometer = -Infinity;

  for (const log of logs) {
    const l = Number(log.liters) || 0;
    const c = Number(log.totalAmount) || 0;
    const odo = Number(log.odometer) || 0;
    totalLiters += l;
    totalFuelCost += c;
    if (odo < startOdometer) startOdometer = odo;
    if (odo > endOdometer) endOdometer = odo;
  }

  if (!Number.isFinite(startOdometer)) startOdometer = 0;
  if (!Number.isFinite(endOdometer)) endOdometer = 0;

  const distanceTraveled = Math.max(0, endOdometer - startOdometer);
  const rawKmL = totalLiters > 0 && distanceTraveled > 0 ? distanceTraveled / totalLiters : 0;
  const rawFuelCpk = distanceTraveled > 0 ? totalFuelCost / distanceTraveled : 0;

  const monthlyAvgKmL = Number(rawKmL.toFixed(2));
  const fuelCpk = Number(rawFuelCpk.toFixed(2));
  const anomaly = evaluateMonthlyAnomaly(distanceTraveled, monthlyAvgKmL, periodLabel);

  return {
    logsCount: logs.length,
    totalLiters: Number(totalLiters.toFixed(2)),
    startOdometer,
    endOdometer,
    distanceTraveled,
    monthlyAvgKmL,
    totalFuelCost: Number(totalFuelCost.toFixed(2)),
    fuelCpk,
    ...anomaly,
  };
}

/**
 * Calcula o desempenho acumulado de um caminhão em um mês/ano específico (1..12).
 */
export function calculateMonthlyFuelPerformance(
  logs: FuelLog[],
  truckId: string,
  month: number,
  year: number
): MonthlyFuelPerformance {
  const periodKey = `${year}-${String(month).padStart(2, '0')}`;
  const periodLabel = formatPeriodLabel(month, year);

  const monthLogs = logs.filter((l) => {
    if (l.truckId !== truckId) return false;
    const d = new Date(l.date);
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
  });

  const stats = calculateCumulativeFuelStats(monthLogs, periodLabel);

  return {
    truckId,
    month,
    year,
    periodKey,
    periodLabel,
    ...stats,
  };
}

/**
 * Agrupa todos os abastecimentos de um caminhão por mês (YYYY-MM) e calcula a Média Mensal Acumulada.
 */
export function calculateTruckMonthlyHistory(logs: FuelLog[], truckId: string): MonthlyFuelPerformance[] {
  const truckLogs = logs.filter((l) => l.truckId === truckId);
  const buckets = new Map<string, { month: number; year: number; items: FuelLog[] }>();

  for (const log of truckLogs) {
    const d = new Date(log.date);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(log);
    } else {
      buckets.set(key, { month, year, items: [log] });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, { month, year, items }]) => {
      const periodLabel = formatPeriodLabel(month, year);
      const stats = calculateCumulativeFuelStats(items, periodLabel);
      return {
        truckId,
        month,
        year,
        periodKey,
        periodLabel,
        ...stats,
      };
    });
}

/**
 * Compatibilidade para análise rápida por lançamento usando a Média Mensal Acumulada do respectivo mês.
 */
export function calculateFuelConsumption(logs: FuelLog[]): {
  logId: string;
  kmTraveled: number;
  litersUsed: number;
  averageKmL: number | null;
  fuelCpk: number;
  isDistorted: boolean;
  message?: string;
}[] {
  const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return sorted.map((current) => {
    const d = new Date(current.date);
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    const perf = calculateMonthlyFuelPerformance(logs, current.truckId, month, year);
    return {
      logId: current.id,
      kmTraveled: perf.distanceTraveled,
      litersUsed: perf.totalLiters,
      averageKmL: perf.monthlyAvgKmL > 0 ? perf.monthlyAvgKmL : null,
      fuelCpk: perf.fuelCpk,
      isDistorted: perf.isAnomalous,
      message:
        perf.anomalyMessage ??
        (perf.monthlyAvgKmL > 0
          ? `Média Mensal (${perf.periodLabel}): ${perf.monthlyAvgKmL.toFixed(1).replace('.', ',')} km/L • Custo de Diesel por KM: R$ ${perf.fuelCpk.toFixed(2).replace('.', ',')}`
          : 'Primeiro registro do mês (aguardando próximo abastecimento para fechar distância mensal)'),
    };
  });
}

/**
 * 2. CUSTO POR KM (CPK OPERACIONAL TOTAL)
 * CPK = (Custos Combustível + Manutenção/Óleo + Pedágios/Viagem) / Total KM Rodados
 */
export function calculateCPK(
  totalFuelCost: number,
  totalMaintenanceCost: number,
  totalTripExpenses: number,
  totalKmTraveled: number
): number {
  if (totalKmTraveled <= 0) return 0;
  const totalCost = totalFuelCost + totalMaintenanceCost + totalTripExpenses;
  return Number((totalCost / totalKmTraveled).toFixed(2));
}

/**
 * 3. MARGEM LÍQUIDA POR FRETE
 * Lucro = Frete Bruto - (Combustível alocado + Pedágios + Despesas Chapa/Outras)
 */
export function calculateNetFreight(
  grossFreight: number,
  fuelCost: number,
  tollCost: number,
  loadingUnloadingCost: number,
  otherExpenses: number
): { netFreight: number; marginPercent: number } {
  const totalTripCost = fuelCost + tollCost + loadingUnloadingCost + otherExpenses;
  const netFreight = Number((grossFreight - totalTripCost).toFixed(2));
  const marginPercent =
    grossFreight > 0 ? Number(((netFreight / grossFreight) * 100).toFixed(1)) : 0;

  return { netFreight, marginPercent };
}

/**
 * 4. ALERTAS DE MANUTENÇÃO PREDITIVA
 * Gatilho: truck.current_odometer >= maintenance.next_service_odometer_alert - 1000
 */
export function checkMaintenanceAlerts(
  truck: Truck,
  maintenances: MaintenanceLog[]
): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = [];

  for (const m of maintenances) {
    if (!m.nextServiceOdometerAlert) continue;

    const kmRemaining = m.nextServiceOdometerAlert - truck.currentOdometer;
    const triggerThreshold = 1000;

    if (kmRemaining <= 0) {
      alerts.push({
        truckId: truck.id,
        truckPlate: truck.plate,
        truckModel: truck.model,
        currentOdometer: truck.currentOdometer,
        nextServiceOdometer: m.nextServiceOdometerAlert,
        kmRemaining,
        category: m.category,
        severity: 'CRITICAL',
        message: `ATENÇÃO CRÍTICA: Revisão de ${formatCategory(m.category)} vencida há ${Math.abs(kmRemaining)} km!`,
      });
    } else if (kmRemaining <= triggerThreshold) {
      alerts.push({
        truckId: truck.id,
        truckPlate: truck.plate,
        truckModel: truck.model,
        currentOdometer: truck.currentOdometer,
        nextServiceOdometer: m.nextServiceOdometerAlert,
        kmRemaining,
        category: m.category,
        severity: 'WARNING',
        message: `Próxima de vencer: Faltam apenas ${kmRemaining} km para a revisão de ${formatCategory(m.category)}.`,
      });
    }
  }

  return alerts;
}

export function formatCategory(cat: string): string {
  const dict: Record<string, string> = {
    OLEO_FILTROS: 'Troca de Óleo e Filtros',
    FREIOS: 'Sistema de Freios',
    SUSPENSAO: 'Suspensão e Molas',
    MOTOR: 'Motor / Injeção',
    CAIXA: 'Caixa de Câmbio / Diferencial',
    ARLA_ELETRICA: 'Sistema Arla 32 / Elétrica',
    OUTROS: 'Manutenção Geral',
  };
  return dict[cat] || cat;
}

/**
 * 5. EFICIÊNCIA HISTÓRICA ACUMULADA DE UM CAMINHÃO (base do simulador de viagem)
 *
 * Usa o método de Média Mensal Acumulada: (MAX(odometer) - MIN(odometer)) / SUM(liters).
 */
export function calculateTruckEfficiency(logs: FuelLog[]): {
  kmPerLiter: number | null;
  sampleKm: number;
  sampleLiters: number;
  intervals: number;
} {
  const stats = calculateCumulativeFuelStats(logs);
  return {
    kmPerLiter: stats.monthlyAvgKmL > 0 ? stats.monthlyAvgKmL : null,
    sampleKm: stats.distanceTraveled,
    sampleLiters: stats.totalLiters,
    intervals: stats.logsCount,
  };
}

/**
 * 6. PROJEÇÃO DE RENTABILIDADE DE UMA CARGA
 * diesel = (distância / km·L⁻¹) × preço do litro
 * lucro  = frete − diesel − pedágios − outras despesas
 */
export function projectTripProfit(input: {
  distanceKm: number;
  grossFreight: number;
  kmPerLiter: number;
  dieselPrice: number;
  tolls?: number;
  otherCosts?: number;
}) {
  const { distanceKm, grossFreight, kmPerLiter, dieselPrice } = input;
  const tolls = input.tolls ?? 0;
  const otherCosts = input.otherCosts ?? 0;
  const liters = kmPerLiter > 0 ? distanceKm / kmPerLiter : 0;
  const dieselCost = liters * dieselPrice;
  const totalCost = dieselCost + tolls + otherCosts;
  const netProfit = grossFreight - totalCost;
  return {
    liters,
    dieselCost,
    totalCost,
    netProfit,
    marginPercent: grossFreight > 0 ? (netProfit / grossFreight) * 100 : 0,
    breakEvenFreight: totalCost,
    freightPerKm: distanceKm > 0 ? grossFreight / distanceKm : 0,
    costPerKm: distanceKm > 0 ? totalCost / distanceKm : 0,
  };
}
