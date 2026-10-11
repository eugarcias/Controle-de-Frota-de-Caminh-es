import { FuelLog, MaintenanceAlert, Truck, MaintenanceLog } from '../types';

/**
 * 1. CÁLCULO DE CONSUMO MÉDIO (km/L) PELO MÉTODO DE TANQUE CHEIO
 * - Para cada abastecimento com isFullTank = true:
 *   localiza o abastecimento com tanque cheio anterior.
 *   Fórmula: km/L = (Odometer Atual - Odometer Anterior) / Soma(Litros desde o anterior até este)
 * - Detecta distorções (< 1.8 km/L ou > 4.5 km/L para caminhões pesados).
 */
export function calculateFuelConsumption(logs: FuelLog[]): {
  logId: string;
  kmTraveled: number;
  litersUsed: number;
  averageKmL: number | null;
  isDistorted: boolean;
  message?: string;
}[] {
  // Ordena por odômetro crescente
  const sorted = [...logs].sort((a, b) => a.odometer - b.odometer);
  const results: {
    logId: string;
    kmTraveled: number;
    litersUsed: number;
    averageKmL: number | null;
    isDistorted: boolean;
    message?: string;
  }[] = [];

  let lastFullTankIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    if (!current.isFullTank) {
      results.push({
        logId: current.id,
        kmTraveled: 0,
        litersUsed: current.liters,
        averageKmL: null,
        isDistorted: false,
        message: 'Abastecimento parcial (não calcula média isolada)',
      });
      continue;
    }

    if (lastFullTankIndex === -1) {
      // Primeiro tanque cheio registrado - ponto de partida
      lastFullTankIndex = i;
      results.push({
        logId: current.id,
        kmTraveled: 0,
        litersUsed: current.liters,
        averageKmL: null,
        isDistorted: false,
        message: 'Primeiro tanque cheio (base inicial de odômetro)',
      });
      continue;
    }

    const previousFull = sorted[lastFullTankIndex];
    const kmTraveled = current.odometer - previousFull.odometer;

    // Soma os litros de todos os abastecimentos intermediários + o tanque cheio atual
    let litersUsed = 0;
    for (let j = lastFullTankIndex + 1; j <= i; j++) {
      litersUsed += sorted[j].liters;
    }

    if (litersUsed <= 0 || kmTraveled <= 0) {
      results.push({
        logId: current.id,
        kmTraveled,
        litersUsed,
        averageKmL: null,
        isDistorted: true,
        message: 'Hodômetro ou litros inconsistentes',
      });
      lastFullTankIndex = i;
      continue;
    }

    const rawKmL = kmTraveled / litersUsed;
    const averageKmL = Number(rawKmL.toFixed(2));
    const isDistorted = averageKmL < 1.8 || averageKmL > 4.5;

    results.push({
      logId: current.id,
      kmTraveled,
      litersUsed: Number(litersUsed.toFixed(2)),
      averageKmL,
      isDistorted,
      message: isDistorted
        ? `Atenção: Consumo fora da faixa esperada para pesados (1.8 a 4.5 km/L)`
        : 'Consumo normal',
    });

    lastFullTankIndex = i;
  }

  return results;
}

/**
 * 2. CUSTO POR KM (CPK)
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
      // Vencida!
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
      // Próxima da revisão
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
